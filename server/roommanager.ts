import { EventEmitter } from "events";
import _ from "lodash";
import { RoomRequest, RoomRequestContext, ServerMessage } from "ott-common/models/messages.js";
import { AuthToken, Role, RoomOptions, Visibility } from "ott-common/models/types.js";
import { Grants } from "ott-common/permissions.js";
import { err, ok, type Result } from "ott-common/result.js";
import { Gauge } from "prom-client";
import type { ClientManagerCommand } from "./clientmanager.js";
import {
	RoomAlreadyLoadedException,
	RoomNameTakenException,
	RoomNotFoundException,
} from "./exceptions.js";
import { UnloadReason } from "./generated.js";
import { getLogger } from "./logger.js";
import { redisClient } from "./redisclient.js";
import { Room, RoomState, RoomStateFromRedis, RoomStatePersistable } from "./room.js";
import storage from "./storage.js";

export const log = getLogger("roommanager");
export const rooms: Room[] = [];
const LOAD_EPOCH_KEY = "roommanager:load_epoch";

export type RoomManagerEvents = "publish" | "load" | "unload" | "command";
export type RoomManagerEventHandlers<E> = E extends "publish"
	? (roomName: string, message: ServerMessage) => void
	: E extends "load"
		? (roomName: string) => void
		: E extends "unload"
			? (roomName: string, reason: UnloadReason) => void
			: E extends "command"
				? // biome-ignore lint/nursery/noShadow: biome migration
					(roomName: string, command: ClientManagerCommand) => void
				: never;
const bus = new EventEmitter();

async function addRoom(room: Room) {
	rooms.push(room);
	const epoch = await redisClient.incr(LOAD_EPOCH_KEY);
	room.loadEpoch = epoch;
	if (epoch >= 2147483640) {
		// ensure we don't overflow the integer
		await redisClient.set(LOAD_EPOCH_KEY, 0);
	}
	bus.emit("load", room.name);
}

let updaterInterval: NodeJS.Timer | null = null;
export async function start() {
	log.info("Starting room manager");

	updaterInterval = setInterval(update, 1000);
}

export async function shutdown() {
	log.info("Shutting down room manager");
	if (updaterInterval) {
		clearInterval(updaterInterval);
		updaterInterval = null;
	}
	await Promise.all(
		rooms.map(room => unloadRoom(room.name, UnloadReason.Shutdown, { preserveRedis: true }))
	);
}

export function redisStateToState(state: RoomStateFromRedis): RoomState {
	const userRoles = new Map<Role, Set<number>>();
	for (const [role, userIds] of state.userRoles) {
		userRoles.set(role, new Set(userIds));
	}
	const grants = new Grants(state.grants);
	return {
		...state,
		grants,
		userRoles,
	};
}

export async function update(): Promise<void> {
	for (const room of rooms) {
		try {
			await room.update();
			await room.sync();
		} catch (e) {
			log.error(`Error updating room ${room.name}: ${e}`);
		}

		if (room.isStale) {
			try {
				await unloadRoom(room.name, UnloadReason.Keepalive);
			} catch (e) {
				log.error(`Error unloading room ${room.name}: ${e}`);
			}
		}
	}
}

export async function createRoom(options: Partial<RoomOptions> & { name: string }): Promise<void> {
	for (const room of rooms) {
		if (options.name.toLowerCase() === room.name.toLowerCase()) {
			log.warn("can't create room, already loaded");
			throw new RoomNameTakenException(options.name);
		}
	}
	if (await redisClient.exists(`room:${options.name}`)) {
		log.warn("can't create room, already in redis");
		throw new RoomNameTakenException(options.name);
	}
	if (await storage.isRoomNameTaken(options.name)) {
		log.warn("can't create room, already exists in database");
		throw new RoomNameTakenException(options.name);
	}
	const room = new Room(options);
	if (!room.isTemporary) {
		await storage.saveRoom(room);
	}
	await room.update();
	await room.sync();
	await addRoom(room);
	log.info(`Room created: ${room.name}`);
}

/**
 * Get a room by name, or load it from storage if it's not loaded.
 * @param roomName
 * @param options
 * @param options.mustAlreadyBeLoaded If true, will throw if the room is not already loaded in the current Monolith.
 * @returns
 */
export async function getRoom(
	roomName: string,
	options: { mustAlreadyBeLoaded?: boolean } = {}
): Promise<Result<Room, RoomNotFoundException | RoomAlreadyLoadedException>> {
	_.defaults(options, {
		mustAlreadyBeLoaded: false,
	});
	for (const room of rooms) {
		if (room.name.toLowerCase() === roomName.toLowerCase()) {
			log.debug("found room in room manager");
			return ok(room);
		}
	}

	if (options.mustAlreadyBeLoaded) {
		return err(new RoomNotFoundException(roomName));
	}

	const redisState = await redisClient.get(`room:${roomName}`);
	if (redisState) {
		log.debug("found room in redis");
		const state = JSON.parse(redisState) as RoomStateFromRedis;
		const fixedState = redisStateToState(state);
		const room = new Room(fixedState);
		await addRoom(room);
		return ok(room);
	}

	const opts = await storage.getRoomByName(roomName);
	if (!opts) {
		log.debug("room not found in room manager, nor redis, nor database");
		return err(new RoomNotFoundException(roomName));
	}
	const room = new Room(opts);
	await addRoom(room);
	return ok(room);
}

export async function unloadRoom(
	room: string | Room,
	reason: UnloadReason,
	options: Partial<{ preserveRedis: boolean }> = {}
): Promise<void> {
	const opts = _.defaults(options, {
		preserveRedis: false,
	});

	let idx = -1;
	if (typeof room === "string") {
		for (let i = 0; i < rooms.length; i++) {
			if (rooms[i].name.toLowerCase() === room.toLowerCase()) {
				idx = i;
				break;
			}
		}
		if (idx < 0) {
			throw new RoomNotFoundException(room);
		}
		room = rooms[idx];
	}
	const roomName = room.name;
	log.info(`Unloading room: ${roomName}`);
	if (reason !== UnloadReason.Commanded) {
		await room.onBeforeUnload();
	}
	idx = rooms[idx].name === room.name ? idx : rooms.indexOf(room); // because the index may have changed across await boundaries
	rooms.splice(idx, 1);
	if (!opts.preserveRedis) {
		await redisClient.del(`room:${room.name}`);
		await redisClient.del(`room-sync:${room.name}`);
	}
	bus.emit("unload", room.name, reason);
}

/**
 * Clear all rooms off of this node.
 * Does not "unload" rooms. Intended to only be used in tests.
 */
export function clearRooms(): void {
	while (rooms.length > 0) {
		rooms.shift();
	}
}

/** Unload all rooms off of this node. Intended to only be used in tests. */
export async function unloadAllRooms(): Promise<void> {
	const names = rooms.map(r => r.name);
	await Promise.all(names.map(name => unloadRoom(name, UnloadReason.Admin)));
}

export function publish(roomName: string, msg: ServerMessage) {
	bus.emit("publish", roomName, msg);
}

export function command(roomName: string, cmd: ClientManagerCommand) {
	bus.emit("command", roomName, cmd);
}

export function on<E extends RoomManagerEvents>(event: E, listener: RoomManagerEventHandlers<E>) {
	bus.on(event, listener);
}

// biome-ignore lint/correctness/noUnusedVariables: biome migration
const gaugeRoomCount = new Gauge({
	name: "ott_room_count",
	help: "The number of loaded rooms.",
	labelNames: ["roomType", "visibility"],
	collect() {
		let counts: Record<"temporary" | "permanent", Record<Visibility, number>> = {
			temporary: {
				public: 0,
				unlisted: 0,
				private: 0,
			},
			permanent: {
				public: 0,
				unlisted: 0,
				private: 0,
			},
		};
		for (const room of rooms) {
			counts[room.isTemporary ? "temporary" : "permanent"][room.visibility] += 1;
		}
		for (let roomType of Object.keys(counts)) {
			for (let visibility of Object.keys(counts[roomType])) {
				let value = counts[roomType][visibility];
				this.set({ roomType, visibility }, value);
			}
		}
	},
});

// biome-ignore lint/correctness/noUnusedVariables: biome migration
const gaugeUsersInRooms = new Gauge({
	name: "ott_users_in_rooms",
	help: "The number of users that the room manager thinks are in rooms.",
	collect() {
		let count = 0;
		for (const room of rooms) {
			count += room.users.length;
		}
		this.set(count);
	},
});

const roommanager = {
	rooms,
	log,
	start,
	shutdown,

	createRoom,
	getRoom,
	unloadRoom,
	clearRooms,
	unloadAllRooms,
	publish,
	command,
	on,
};

export default roommanager;
