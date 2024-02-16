// This load test represents a more realistic scenario where users are joining rooms and performing actions.
// Appropriately scaling this test requires a ratio of 1:5 between the number of rooms and the number of VUs.

import http from "k6/http";
import ws from "k6/ws";
import { sleep, check } from "k6";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { getAuthToken, createRoom, HOSTNAME, RoomState, reqVideo } from "./utils.js";

export const options = {
	// A number specifying the number of VUs to run concurrently.
	vus: 500,
	// A string specifying the total duration of the test run.
	duration: "1h",
};

const rooms = [];
for (let i = 0; i < 100; i++) {
	rooms.push(`load-test-${i}`);
}

const VIDEOS = [
	{ service: "youtube", id: "dQw4w9WgXcQ" },
	{ service: "direct", id: "https://vjs.zencdn.net/v/oceans.mp4" },
	{ service: "vimeo", id: "94338566" },
];

export function setup() {
	const token = getAuthToken();
	for (let room of rooms) {
		// TODO: some of the rooms should be permanent
		createRoom(room, token, { visibility: "public", isTemporary: true });
	}
	sleep(1);
}

export default function () {
	sleep(5 * Math.random());
	const token = getAuthToken();
	const room = randomItem(rooms);
	console.log(`User is joining room ${room}`);
	const url = `ws://${HOSTNAME}/api/room/${room}`;
	const res = ws.connect(url, null, function (socket) {
		const state = new RoomState();
		const user = new UserEmulator(room, token, socket);

		socket.on("open", () => {
			socket.send(JSON.stringify({ action: "auth", token: token }));

			socket.setTimeout(act, 1000);
		});
		socket.on("message", data => {
			const msg = JSON.parse(data);
			state.handleMessage(msg);
		});
		socket.on("close", code => {
			if (code >= 4000) {
				console.log("disconnected ws", code);
			}
			check(code, { "ws close status is 1000": c => c === 1000 });
		});
		socket.setTimeout(function () {
			socket.close(1000);
		}, 30000 * Math.random() + 50000);

		/** Perform a random action. That would make sense for the current room state. */
		function act() {
			user.act(state);
			socket.setTimeout(act, 10000 * Math.random() + 1000);
		}
	});

	check(res, { "ws status is 101": r => r && r.status === 101 });
}

class UserEmulator {
	constructor(room, token, socket) {
		this.room = room;
		this.token = token;
		this.socket = socket;
	}

	// TODO: send client playback status updates

	/**
	 * Perform a random action that would make sense for the given room state.
	 */
	act(state) {
		let actions = ["chat", "add"];
		if (state.state.currentSource) {
			actions = actions.concat(["playpause", "seek", "skip"]);
		}
		if (state.state.queue && state.state.queue.length > 0) {
			actions.push("remove");
		}
		const action = randomItem(actions);
		switch (action) {
			case "chat":
				this.roomRequest({
					type: 11,
					text: "foo",
				});
				break;
			case "add":
				const video = randomItem(VIDEOS);
				const resp1 = reqVideo(this.room, this.token, video, {
					action: "add",
					target: "queue",
				});
				check(resp1, {
					"response code was acceptable": r => r.status < 500,
				});
				break;
			case "remove":
				const video2 = randomItem(VIDEOS);
				const resp2 = reqVideo(this.room, this.token, video2, {
					action: "remove",
					target: "queue",
				});
				check(resp2, {
					"response code was acceptable": r => r.status < 500,
				});
				break;
			case "playpause":
				this.roomRequest({
					type: 2,
					state: !state.state.isPlaying,
				});
				break;
			case "seek":
				const max = state.state.currentSource ? state.state.currentSource.length : 0;
				this.roomRequest({
					type: 4,
					value: Math.random() * max,
				});
				break;
			case "skip":
				this.roomRequest({
					type: 3,
				});
				break;
		}
	}

	/**
	 * Send a message on the websocket. Must be a JSON stringable object.
	 */
	send(obj) {
		const msg = JSON.stringify(obj);
		this.socket.send(msg);
	}

	roomRequest(obj) {
		this.send({
			action: "req",
			request: obj,
		});
	}
}
