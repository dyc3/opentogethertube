import { Room, type RoomState, type RoomStateFromRedis } from "./room.js";
import type { Role, RoomOptions, Visibility } from "ott-common/models/types.js";
import _ from "lodash";
import { getLogger } from "./logger.js";
import { redisClient } from "./redisclient.js";
import storage from "./storage.js";
import {
	type RoomAlreadyLoadedException,
	RoomNameTakenException,
	RoomNotFoundException,
} from "./exceptions.js";
import type { ServerMessage } from "ott-common/models/messages.js";
import { Gauge } from "prom-client";
import { EventEmitter } from "node:events";
import { type Result, ok, err } from "ott-common/result.js";
import { Grants } from "ott-common/permissions.js";
import type { ClientManagerCommand } from "./clientmanager.js";
import { UnloadReason } from "./generated.js";

export const log = getLogger("roommanager");
const LOAD_EPOCH_KEY = "roommanager:load_epoch";
type RoomResult = Result<Room, RoomNotFoundException | RoomAlreadyLoadedException>;
type RoomEntry =
	| { state: "loading"; promise: Promise<RoomResult> }
	| { state: "loaded"; room: Room };
const roomRegistry = new Map<string, RoomEntry>();

export function getRooms(): readonly Room[] {
	return Array.from(roomRegistry.values()).flatMap(entry =>
		entry.state === "loaded" ? [entry.room] : [],
	);
}

export type RoomManagerEvents = "publish" | "load" | "unload" | "command";
export type RoomManagerEventHandlers<E> = E extends "publish"
	? (roomName: string, message: ServerMessage) => void
	: E extends "load"
		? (room: Room) => void
		: E extends "unload"
			? (roomName: string, reason: UnloadReason) => void
			: E extends "command"
				? (roomName: string, command: ClientManagerCommand) => void
				: never;
const bus = new EventEmitter();

function reserveRoom(roomName: string, build: () => Promise<RoomResult>): Promise<RoomResult> {
	const key = roomName.toLowerCase();
	async function completeLoad(): Promise<RoomResult> {
		// Yield until the name reservation is installed.
		await Promise.resolve();
		let room: Room | undefined;
		try {
			const result = await build();
			if (!result.ok) {
				return result;
			}
			room = result.value;
			const epoch = await redisClient.incr(LOAD_EPOCH_KEY);
			room.loadEpoch = epoch;
			if (epoch >= 2147483640) {
				// Keep the epoch within the protocol's integer range.
				await redisClient.set(LOAD_EPOCH_KEY, 0);
			}
			if (roomRegistry.get(key) !== entry) {
				// Tests may clear the registry while a load is pending.
				room.throttledSync.cancel();
				room.saveStateToRedisDebounced.cancel();
				return err(new RoomNotFoundException(roomName));
			}
			roomRegistry.set(key, { state: "loaded", room });
			bus.emit("load", room);
			return result;
		} catch (e) {
			room?.throttledSync.cancel();
			room?.saveStateToRedisDebounced.cancel();
			throw e;
		} finally {
			if (roomRegistry.get(key) === entry) {
				roomRegistry.delete(key);
			}
		}
	}
	const entry: RoomEntry = { state: "loading", promise: completeLoad() };
	roomRegistry.set(key, entry);
	return entry.promise;
}

let updaterInterval: ReturnType<typeof setInterval> | null = null;
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
		getRooms().map(room => unloadRoom(room, UnloadReason.Shutdown, { preserveRedis: true })),
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
	// A snapshot keeps unloads from changing this iteration.
	for (const room of getRooms()) {
		try {
			await room.update();
			await room.sync();
		} catch (e) {
			log.error(`Error updating room ${room.name}: ${e}`);
		}

		if (room.isStale) {
			try {
				await unloadRoom(room, UnloadReason.Keepalive);
			} catch (e) {
				log.error(`Error unloading room ${room.name}: ${e}`);
			}
		}
	}
}

export async function createRoom(options: Partial<RoomOptions> & { name: string }): Promise<void> {
	if (roomRegistry.has(options.name.toLowerCase())) {
		log.warn("can't create room, already loaded or loading");
		throw new RoomNameTakenException(options.name);
	}
	const result = await reserveRoom(options.name, async () => {
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
		return ok(room);
	});
	result.unwrap();
	log.info(`Room created: ${options.name}`);
}

/**
 * Get a room by name, or load it from storage if it's not loaded.
 * @param roomName
 * @param options
 * @param options.mustAlreadyBeLoaded If true, return an error unless the room is already loaded in this Monolith.
 * @returns
 */
export async function getRoom(
	roomName: string,
	options: { mustAlreadyBeLoaded?: boolean } = {},
): Promise<RoomResult> {
	const entry = roomRegistry.get(roomName.toLowerCase());
	if (entry?.state === "loaded") {
		log.debug("found room in room manager");
		return ok(entry.room);
	}

	if (options.mustAlreadyBeLoaded) {
		return err(new RoomNotFoundException(roomName));
	}

	if (entry?.state === "loading") {
		return entry.promise;
	}
	return reserveRoom(roomName, () => loadRoom(roomName));
}

async function loadRoom(roomName: string): Promise<RoomResult> {
	const redisState = await redisClient.get(`room:${roomName}`);
	if (redisState) {
		log.debug("found room in redis");
		const state = JSON.parse(redisState) as RoomStateFromRedis;
		const fixedState = redisStateToState(state);
		const room = new Room(fixedState);
		return ok(room);
	}

	const opts = await storage.getRoomByName(roomName);
	if (!opts) {
		log.debug("room not found in room manager, nor redis, nor database");
		return err(new RoomNotFoundException(roomName));
	}
	const room = new Room(opts);
	return ok(room);
}

export async function unloadRoom(
	room: string | Room,
	reason: UnloadReason,
	options: Partial<{ preserveRedis: boolean }> = {},
): Promise<void> {
	const opts = _.defaults(options, {
		preserveRedis: reason === UnloadReason.Commanded,
	});

	if (typeof room === "string") {
		const entry = roomRegistry.get(room.toLowerCase());
		let loaded: Room | undefined;
		if (entry?.state === "loading") {
			const result = await entry.promise;
			if (result.ok) {
				loaded = result.value;
			}
		} else if (entry?.state === "loaded") {
			loaded = entry.room;
		}
		if (!loaded) {
			if (reason === UnloadReason.Commanded) {
				log.warn(`Ignoring commanded unload for room that is not loaded: ${room}`);
				return;
			}
			throw new RoomNotFoundException(room);
		}
		room = loaded;
	}
	const key = room.name.toLowerCase();
	const entry = roomRegistry.get(key);
	if (entry?.state !== "loaded" || entry.room !== room) {
		return;
	}
	const roomName = room.name;
	log.info(
		`Unloading room: ${roomName} (reason: ${reason}, preserveRedis: ${opts.preserveRedis}, users: ${room.users.length}, temporary room: ${room.isTemporary}, queue length: ${room.queue.length})`,
	);

	// sanity check: don't unload a room that has users in it and the reason is Keepalive
	if (reason === UnloadReason.Keepalive && room.users.length > 0) {
		// room conflict resolution is resolved by the balancer, and the monolith will receive a Commanded reason if that is the case.
		log.warn(
			`Attempted to unload room ${room.name} with users present (reason: Keepalive). Refusing because this is likely a bug.`,
		);
		return;
	}

	if (reason !== UnloadReason.Commanded) {
		await room.onBeforeUnload();
	}
	// Another unload may have completed while we were saving.
	if (roomRegistry.get(key) !== entry) {
		return;
	}
	if (!opts.preserveRedis) {
		await redisClient.del(`room:${room.name}`);
		await redisClient.del(`room-sync:${room.name}`);
	}
	if (roomRegistry.get(key) !== entry) {
		return;
	}
	roomRegistry.delete(key);
	bus.emit("unload", room.name, reason);
}

/**
 * Clear all rooms off of this node.
 * Does not "unload" rooms. Intended to only be used in tests.
 */
export function clearRooms(): void {
	roomRegistry.clear();
}

/** Unload all rooms off of this node. Intended to only be used in tests. */
export async function unloadAllRooms(): Promise<void> {
	await Promise.all(getRooms().map(room => unloadRoom(room, UnloadReason.Admin)));
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
		const counts: Record<"temporary" | "permanent", Record<Visibility, number>> = {
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
		for (const room of getRooms()) {
			counts[room.isTemporary ? "temporary" : "permanent"][room.visibility] += 1;
		}
		for (const roomType of Object.keys(counts)) {
			for (const visibility of Object.keys(counts[roomType])) {
				const value = counts[roomType][visibility];
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
		for (const room of getRooms()) {
			count += room.users.length;
		}
		this.set(count);
	},
});

const roommanager = {
	getRooms,
	log,
	start,
	shutdown,
	update,

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
