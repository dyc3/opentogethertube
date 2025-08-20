/* eslint-disable no-console */
// The purpose of this test is to simulate monolith restarts and ensure that users can reconnect to their rooms without being interrupted.
// This test requires manual intervention to restart the server while the test is running.

// Instructions:
// 1. Run 3 monoliths, 1 balancer
// 2. Run the test
// 3. After all the VUs have connected, restart one of the monoliths
// 4. Observe that the VUs reconnect to the same room
// 5. Repeat steps 3-4 as many times as needed

import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { check, fail, sleep } from "k6";
import ws from "k6/ws";
import { createRoom, getAuthToken, HOSTNAME } from "./utils.js";

export const options = {
	executor: "constant-vus",
	vus: 1000,
	duration: "1h",
};

export function setup() {
	const rooms = [];
	for (let i = 0; i < 10; i++) {
		rooms.push(`load-test-${i}`);
	}

	const token = getAuthToken();
	for (let room of rooms) {
		createRoom(room, token, { visibility: "public", isTemporary: false });
	}
	sleep(1);

	const tokens = [token];
	for (let i = 0; i < 100; i++) {
		tokens.push(getAuthToken());
	}

	return { rooms, tokens };
}

export default function (data) {
	const { rooms, tokens } = data;
	const room = randomItem(rooms);
	const token = randomItem(tokens);
	doConnection(room, token);
}

function doConnection(room, token) {
	console.log(`User is joining room ${room}`);
	const url = `ws://${HOSTNAME}/api/room/${room}`;
	const res = ws.connect(url, null, socket => {
		socket.on("open", () => {
			socket.send(JSON.stringify({ action: "auth", token: token }));
		});
		socket.setTimeout(
			() => {
				socket.close(1000);
			},
			1000 * 60 * 60 * 2
		);
		socket.on("close", code => {
			if (code >= 4000) {
				console.log("disconnected ws", code);
			}
			check(code, { "ws close status is < 4000": c => c < 4000 });
			doConnection(room, token);
		});
		socket.on("error", e => {
			fail(`error: ${e}`);
		});
	});
	check(res, { "ws status is 101": r => r && r.status === 101 });
}
