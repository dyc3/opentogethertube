import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { check, sleep } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import ws from "k6/ws";
import { createRoom, getAuthToken, HOSTNAME } from "./utils.js";

// This is specially crafted to test the message fanout performance of the system.

export const options = {
	// A number specifying the number of VUs to run concurrently.
	vus: 3,
	// A string specifying the total duration of the test run.
	// duration: "10s",

	stages: [
		{ duration: "10s", target: 10 },
		{ duration: "10m", target: 2000 }, // just slowly ramp-up to a HUGE load
	],
};

export function setup() {
	const tokens = [];
	for (let i = 0; i < 10; i++) {
		tokens.push(getAuthToken());
	}
	for (let i = 0; i < 2000 / 5 + 1; i++) {
		const room = `load-test-${i}`;
		createRoom(room, tokens[0], { visibility: "public", isTemporary: false });
		sleep(0.02);
	}
	return {
		tokens,
	};
}

export default function ({ tokens }) {
	const maxRooms = Math.min(Math.floor(exec.instance.vusActive / 5 + 1), 400);
	const token = tokens[exec.vu.idInTest % tokens.length];
	const room = `load-test-${randomIntBetween(0, maxRooms)}`;
	console.log(`User is joining room ${room}`);
	const url = `ws://${HOSTNAME}/api/room/${room}`;
	const res = ws.connect(url, null, socket => {
		let gotChat = false;
		socket.on("open", () => {
			socket.send(JSON.stringify({ action: "auth", token: token }));
		});
		socket.on("message", data => {
			const msg = JSON.parse(data);
			if (msg.action === "chat") {
				gotChat = true;
			}
		});
		socket.on("close", code => {
			if (code >= 4000) {
				console.log("disconnected ws", code);
			}
			check(code, { "ws close status is 1000": c => c === 1000 });
			check(gotChat, {
				"got chat message": b => b,
			});
		});
		socket.setTimeout(
			() => {
				socket.close(1000);
			},
			60000 * 1 + Math.random() * 30000
		);
		socket.setInterval(() => {
			socket.send(
				JSON.stringify({
					action: "req",
					request: {
						type: 11,
						text: "foo",
					},
				})
			);
		}, 50);
	});

	check(res, { "status is 101": r => r && r.status === 101 });
	if (res.status !== 101) {
		console.log("ws connect error", JSON.stringify(res));
	}
}
