import { Room } from "./room";
import { Visibility, QueueMode, RoomOptions, RoomState } from "../common/models/types";
import _ from "lodash";
import NanoTimer from "nanotimer";
import { getLogger } from "../logger.js";
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { RoomRequest } from "../common/models/messages";
import storage from "../storage";
import { RoomNotFoundException } from "./exceptions";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
const redis = {
	keys: promisify(redisClient.keys).bind(redisClient),
	get: promisify(redisClient.get).bind(redisClient),
	set: promisify(redisClient.set).bind(redisClient),
	del: promisify(redisClient.del).bind(redisClient) as (key: string) => Promise<number>,
};
export const rooms: Room[] = [];
// const redisSubscriber = createSubscriber();

function addRoom(room: Room) {
	rooms.push(room);
	// redisSubscriber.subscribe(`room_requests:${room.name}`);
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

export async function update() {
	for (const room of rooms) {
		await room.update();
		await room.sync();

		if (room.isStale) {
			await UnloadRoom(room.name);
		}
	}
}

export async function CreateRoom(options: RoomOptions) {
	const room = new Room(options);
	await room.update();
	await room.sync();
	addRoom(room);
	log.info(`Room created: ${room.name}`);
}

export async function GetRoom(roomName: string) {
	let room = _.find(rooms, { name: roomName });
	if (room) {
		return room;
	}
	// FIXME: don't load room if room is already present in redis.
	const opts = await storage.getRoomByName(roomName);
	if (!opts) {
		throw new RoomNotFoundException(roomName);
	}
	room = new Room(opts);
	addRoom(room);
	return room;
}

export async function UnloadRoom(roomName: string): Promise<void> {
	log.info(`Unloading stale room: ${roomName}`);
	const idx = _.findIndex(rooms, { name: roomName });
	if (idx >= 0) {
		await rooms[idx].onBeforeUnload();
	}
	else {
		throw new RoomNotFoundException(roomName);
	}
	rooms.splice(idx, 1);
	await redis.del(`room:${roomName}`);
}

export default {
	rooms,
	start,

	CreateRoom,
	GetRoom,
	UnloadRoom,
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
