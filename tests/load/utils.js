import http from "k6/http";
import { sleep, check } from "k6";

export const HOSTNAME = "localhost:8080";

/**
 *
 * @returns {string}
 */
export function getAuthToken() {
	let resp = http.get(`http://${HOSTNAME}/api/auth/grant`);
	check(resp, { "token status is 200": r => r && r.status === 200 });
	const token = JSON.parse(resp.body).token;
	check(token, { "token is not empty": t => t && t.length > 0 });
	return token;
}

/**
 * Generate a random room name.
 * @returns {string}
 */
export function randomRoomName() {
	const prefix = "load-test-";
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
	let name = prefix;
	for (let i = 0; i < 10; i++) {
		name += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return name;
}

/**
 * Generate a list of random room names. Each name is guaranteed to be unique in the list.
 * @param {number} count The number of room names to generate
 * @returns {string[]}
 */
export function randomRoomNames(count) {
	const names = [];
	while (names.length < count) {
		const name = randomRoomName();
		if (!names.includes(name)) {
			names.push(name);
		}
	}
	return names;
}

export function createRoom(name, token, roomOptions = {}, options = { doCheck: true }) {
	const body = Object.assign(
		{
			name: name,
		},
		roomOptions
	);
	const url = `http://${HOSTNAME}/api/room/create`;
	let resp = http.post(url, JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${token}`,
		},
	});
	if (options.doCheck) {
		check(resp, {
			"room created": r => {
				if (r.status === 201) {
					return true;
				}
				let body = JSON.parse(r.body);
				if (body.error && body.error.name === "RoomNameTakenException") {
					return true;
				}
				return false;
			},
		});
	}

	if (resp.status !== 201) {
		console.log(`Failed to create room ${name}: ${resp.body}`);
	}
}

/**
 * Add, remove, or vote for a video in a room.
 * @param {*} room
 * @param {*} token
 * @param {*} videoId
 */
export function reqVideo(room, token, videoId, options = { action: "add", target: "queue" }) {
	const url =
		options.target === "queue"
			? `http://${HOSTNAME}/api/room/${room}/queue`
			: `http://${HOSTNAME}/api/room/${room}/vote`;
	const body = videoId;
	let fn;
	if (options.action === "add") {
		fn = http.post;
	} else if (options.action === "remove") {
		fn = http.del;
	} else {
		throw new Error(`Invalid action: ${options.action}`);
	}
	const resp = fn(url, JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${token}`,
		},
	});
	return resp;
}

/**
 * Helper class to keep track of the state of a room. Does roughly what the client does to keep track of the room state.
 */
export class RoomState {
	constructor(roomName) {
		this.roomName = roomName;
		this.state = {};
		this.you = null;
		this.users = new Map();
	}

	handleMessage(msg) {
		if (msg.action === "sync") {
			delete msg.action;
			this.state = Object.assign(this.state, msg);
		} else if (msg.action === "you") {
			this.you = msg.info.id;
		} else if (msg.action === "user") {
			this.handleUserUpdate(msg.update);
		}
	}

	handleUserUpdate(update) {
		if (update.kind === "init") {
			for (const user of update.value) {
				this.users.set(user.id, user);
			}
		} else if (update.kind === "update") {
			let user = this.users.get(update.value.id);
			if (!user) {
				this.users.set(update.value.id, update.value);
			} else {
				Object.assign(user, update.value);
			}
		} else if (update.kind === "remove") {
			this.users.delete(update.value);
		}
	}
}
