import { Room, Visibility, QueueMode, RoomOptions, RoomState } from "./room";
import _ from "lodash";
const NanoTimer = require("nanotimer");
import { getLogger } from "../logger.js";
import { redisClient } from "../redisclient";
import { promisify } from "util";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
const redis = {
	keys: promisify(redisClient.keys).bind(redisClient),
	get: promisify(redisClient.get).bind(redisClient),
	set: promisify(redisClient.set).bind(redisClient),
	del: promisify(redisClient.del).bind(redisClient),
}
let rooms: Room[] = [];

export async function start() {
	let keys = await redis.keys("room:*")
	for (let roomKey of keys) {
		let text = await redis.get(roomKey)
		if (!text) {
			continue;
		}
		let state = JSON.parse(text) as RoomState;
		let room = new Room(state);
		rooms.push(room);
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

export default {
	async CreateRoom(options: RoomOptions) {
		let room = new Room(options);
		await room.update();
		rooms.push(room);
		log.info(`Room created: ${room.name}`);
	},

	async GetRoom(roomName: string) {
		return _.find(rooms, { name: roomName });
	},

	start,
}