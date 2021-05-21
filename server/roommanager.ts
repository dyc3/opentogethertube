import { Room, Visibility, QueueMode, RoomOptions, RoomState } from "./room";
import _, { create } from "lodash";
const NanoTimer = require("nanotimer");
import { getLogger } from "../logger.js";
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { RoomRequest } from "./messages";
import storage from "../storage";
import { RoomNotFoundException } from "./exceptions";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
const redis = {
	keys: promisify(redisClient.keys).bind(redisClient),
	get: promisify(redisClient.get).bind(redisClient),
	set: promisify(redisClient.set).bind(redisClient),
	del: promisify(redisClient.del).bind(redisClient) as (key: string) => Promise<number>,
}
const ROOM_UNLOAD_AFTER = 240; // seconds
let rooms: Room[] = [];
// const redisSubscriber = createSubscriber();

function addRoom(room: Room) {
	rooms.push(room);
	// redisSubscriber.subscribe(`room_requests:${room.name}`);
}

export async function start() {
	let keys = await redis.keys("room:*")
	for (let roomKey of keys) {
		let text = await redis.get(roomKey)
		if (!text) {
			continue;
		}
		let state = JSON.parse(text) as RoomState;
		let room = new Room(state);
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
	}
}

export async function CreateRoom(options: RoomOptions) {
	let room = new Room(options);
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
	let opts = await storage.getRoomByName(roomName);
	if (!opts) {
		throw new RoomNotFoundException(roomName);
	}
	room = new Room(opts);
	addRoom(room);
	return room;
}

export async function UnloadRoom(roomName: string) {
	let room = _.find(rooms, { name: roomName });
	if (room) {
		await room.onBeforeUnload();
	}
	rooms = _.remove(rooms, { name: roomName });
	await redis.del(`room:${roomName}`);
}

export default {
	start,

	CreateRoom,
	GetRoom,
	UnloadRoom,
}

// redisSubscriber.on("message", async (channel, text) => {
// 	if (!channel.startsWith("room_requests:")) {
// 		return
// 	}
// 	let roomName = text.split(":")[1];
// 	let room = await GetRoom(roomName);
// 	let request = JSON.parse(text) as RoomRequest;
// 	await room.processRequest(request);
// })