import { Room, RoomState, RoomStateFromRedis, RoomStatePersistable } from "./room";
import { AuthToken, Role, RoomOptions, Visibility } from "../common/models/types";
import _ from "lodash";
import { getLogger } from "./logger";
import { redisClient } from "./redisclient";
import storage from "./storage";
import {
	RoomAlreadyLoadedException,
	RoomNameTakenException,
	RoomNotFoundException,
} from "./exceptions";
import { RoomRequest, RoomRequestContext, ServerMessage } from "../common/models/messages";
import { Gauge } from "prom-client";
import { EventEmitter } from "events";
import { Result, ok, err } from "../common/result";
import { Grants } from "../common/permissions";
import type { ClientManagerCommand } from "./clientmanager";

export const log = getLogger("roommanager");
export const rooms: Room[] = [];

export type RoomManagerEvents = "publish" | "load" | "unload" | "command";
export type RoomManagerEventHandlers<E> = E extends "publish"
	? (roomName: string, message: ServerMessage) => void
	: E extends "load"
	? (roomName: string) => void
	: E extends "unload"
	? (roomName: string) => void
	: E extends "command"
	? (roomName: string, command: ClientManagerCommand) => void
	: never;
const bus = new EventEmitter();

function addRoom(room: Room) {
	rooms.push(room);
	bus.emit("load", room.name);
}

export async function start() {
	log.info("Starting room manager");
	const keys = await redisClient.keys("room:*");
	for (const roomKey of keys) {
		const text = await redisClient.get(roomKey);
		if (!text) {
			continue;
		}
		const state = JSON.parse(text) as RoomStateFromRedis;
		const fixedState = redisStateToState(state);
		const room = new Room(fixedState);
		addRoom(room);
	}
	log.info(`Loaded ${keys.length} rooms from redis`);

	setInterval(update, 1000);
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
				await unloadRoom(room.name);
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
	addRoom(room);
	log.info(`Room created: ${room.name}`);
}

/**
 * Get a room by name, or load it from storage if it's not loaded.
 * @param roomName
 * @param options
 * @param options.mustAlreadyBeLoaded If true, will throw if the room is not already loaded in the current Node.
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

	const opts = (await storage.getRoomByName(roomName)) as RoomStatePersistable;
	if (opts) {
		if (await redisClient.exists(`room:${opts.name}`)) {
			log.debug("found room in database, but room is already in redis");
			return err(new RoomAlreadyLoadedException(opts.name));
		}
	} else {
		if (await redisClient.exists(`room:${roomName}`)) {
			log.debug("found room in redis, not loading");
			return err(new RoomAlreadyLoadedException(roomName));
		}
		log.debug("room not found in room manager, nor redis, nor database");
		return err(new RoomNotFoundException(roomName));
	}
	const room = new Room(opts);
	addRoom(room);
	return ok(room);
}

export async function unloadRoom(roomName: string): Promise<void> {
	let idx = -1;
	for (let i = 0; i < rooms.length; i++) {
		if (rooms[i].name.toLowerCase() === roomName.toLowerCase()) {
			idx = i;
			break;
		}
	}
	if (idx >= 0) {
		log.info(`Unloading room: ${roomName}`);
		await rooms[idx].onBeforeUnload();
	} else {
		throw new RoomNotFoundException(roomName);
	}
	rooms.splice(idx, 1);
	await redisClient.del(`room:${roomName}`);
	await redisClient.del(`room-sync:${roomName}`);
	bus.emit("unload", roomName);
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
	await Promise.all(names.map(unloadRoom));
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

const gaugeRoomCount = new Gauge({
	name: "ott_room_count",
	help: "The number of loaded rooms.",
	labelNames: ["room_type", "visibility"],
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
		for (let room_type of Object.keys(counts)) {
			for (let visibility of Object.keys(counts[room_type])) {
				let value = counts[room_type][visibility];
				this.set({ room_type, visibility }, value);
			}
		}
	},
});

const guageUsersInRooms = new Gauge({
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
