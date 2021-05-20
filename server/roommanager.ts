import { Room, Visibility, QueueMode, RoomOptions, RoomState } from "./room";
import _, { create } from "lodash";
const NanoTimer = require("nanotimer");
import { getLogger } from "../logger.js";
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { RoomRequest } from "./messages";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
const redis = {
	keys: promisify(redisClient.keys).bind(redisClient),
	get: promisify(redisClient.get).bind(redisClient),
	set: promisify(redisClient.set).bind(redisClient),
	del: promisify(redisClient.del).bind(redisClient),
}
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
	nanotimer.setInterval(async () => {
		for (const room of rooms) {
			await room.update();
			await room.sync();
		}
	}, '', '1000m');
}

async function GetRoom(roomName: string) {
	return _.find(rooms, { name: roomName });
}

export default {
	async CreateRoom(options: RoomOptions) {
		let room = new Room(options);
		await room.update();
		await room.sync();
		addRoom(room);
		log.info(`Room created: ${room.name}`);
	},

	GetRoom,
	start,
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