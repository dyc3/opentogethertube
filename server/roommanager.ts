import { Room } from "./room";
import { RoomOptions, RoomState } from "../common/models/types";
import _ from "lodash";
import NanoTimer from "nanotimer";
import { getLogger } from "../logger.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
import storage from "../storage";
import { RoomAlreadyLoadedException, RoomNameTakenException, RoomNotFoundException } from "./exceptions";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
const redis = {
	keys: promisify(redisClient.keys).bind(redisClient),
	get: promisify(redisClient.get).bind(redisClient),
	set: promisify(redisClient.set).bind(redisClient),
	del: promisify(redisClient.del).bind(redisClient) as (key: string) => Promise<number>,
	exists: promisify(redisClient.exists).bind(redisClient),
};
export const rooms: Room[] = [];

function addRoom(room: Room) {
	rooms.push(room);
}

export async function start() {
	const keys = await redis.keys("room:*");
	for (const roomKey of keys) {
		const text = await redis.get(roomKey);
		if (!text) {
			continue;
		}
		const state = JSON.parse(text) as RoomState;
		const room = new Room(state);
		addRoom(room);
	}
	log.info(`Loaded ${keys.length} rooms from redis`);

	const nanotimer = new NanoTimer();
	nanotimer.setInterval(update, '', '1000m');
}

export async function update(): Promise<void> {
	for (const room of rooms) {
		await room.update();
		await room.sync();

		if (room.isStale) {
			await UnloadRoom(room.name);
		}
	}
}

export async function CreateRoom(options: Partial<RoomOptions>): Promise<void> {
	for (const room of rooms) {
		if (options.name.toLowerCase() === room.name.toLowerCase()) {
			log.warn("can't create room, already loaded");
			throw new RoomNameTakenException(options.name);
		}
	}
	if (await redis.exists(`room:${options.name}`)) {
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

export async function GetRoom(roomName: string): Promise<Room> {
	for (const room of rooms) {
		if (room.name.toLowerCase() === roomName.toLowerCase()) {
			log.debug("found room in room manager");
			return room;
		}
	}

	const opts = await storage.getRoomByName(roomName);
	if (opts) {
		if (await redis.exists(`room:${opts.name}`)) {
			log.debug("found room in database, but room is already in redis");
			throw new RoomAlreadyLoadedException(opts.name);
		}
	}
	else {
		if (await redis.exists(`room:${roomName}`)) {
			log.debug("found room in redis, not loading");
			throw new RoomAlreadyLoadedException(roomName);
		}
		log.debug("room not found in room manager, nor redis, nor database");
		throw new RoomNotFoundException(roomName);
	}
	const room = new Room(opts);
	addRoom(room);
	return room;
}

export async function UnloadRoom(roomName: string): Promise<void> {
	log.info(`Unloading stale room: ${roomName}`);
	let idx = -1;
	for (let i = 0; i < rooms.length; i++) {
		if (rooms[i].name.toLowerCase() === roomName.toLowerCase()) {
			idx = i;
			break;
		}
	}
	if (idx >= 0) {
		await rooms[idx].onBeforeUnload();
	}
	else {
		throw new RoomNotFoundException(roomName);
	}
	rooms.splice(idx, 1);
	await redis.del(`room:${roomName}`);
	await redis.del(`room-sync:${roomName}`);
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

export default {
	rooms,
	start,

	CreateRoom,
	GetRoom,
	UnloadRoom,
	clearRooms,
};

// redisSubscriber.on("message", async (channel, text) => {
// 	if (!channel.startsWith("room_requests:")) {
// 		return
// 	}
// 	let roomName = text.split(":")[1];
// 	let room = await GetRoom(roomName);
// 	let request = JSON.parse(text) as RoomRequest;
// 	await room.processRequest(request);
// })
