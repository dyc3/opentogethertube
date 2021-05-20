import { Room, Visibility, QueueMode, RoomOptions } from "./room";
import _ from "lodash";
const NanoTimer = require("nanotimer");
import { getLogger } from "../logger.js";
// WARN: do NOT import clientmanager

const log = getLogger("roommanager");
let rooms: Room[] = [];

export function start() {
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
		if (options.name === "") {
			throw new Error("bad");
		}
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