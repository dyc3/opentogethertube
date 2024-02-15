import http from "k6/http";
import ws from "k6/ws";
import { sleep, check } from "k6";
import { getAuthToken, randomRoomNames, createRoom, HOSTNAME } from "./utils.js";

export const options = {
	// A number specifying the number of VUs to run concurrently.
	vus: 20,
	// A string specifying the total duration of the test run.
	// duration: "10s",

	stages: [
		{ duration: "10m", target: 2000 }, // just slowly ramp-up to a HUGE load
	],

	// Uncomment this section to enable the use of Browser API in your tests.
	//
	// See https://grafana.com/docs/k6/latest/using-k6-browser/running-browser-tests/ to learn more
	// about using Browser API in your test scripts.
	//
	// scenarios: {
	//   // The scenario name appears in the result summary, tags, and so on.
	//   // You can give the scenario any name, as long as each name in the script is unique.
	//   ui: {
	//     // Executor is a mandatory parameter for browser-based tests.
	//     // Shared iterations in this case tells k6 to reuse VUs to execute iterations.
	//     //
	//     // See https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ for other executor types.
	//     executor: 'shared-iterations',
	//     options: {
	//       browser: {
	//         // This is a mandatory parameter that instructs k6 to launch and
	//         // connect to a chromium-based browser, and use it to run UI-based
	//         // tests.
	//         type: 'chromium',
	//       },
	//     },
	//   },
	// }
};

const rooms = ["foo1", "foo2", "foo3", "foo4", "foo5", "foo6", "foo7", "foo8", "foo9", "foo10"];

export function setup() {
	const token = getAuthToken();
	for (let room of rooms) {
		createRoom(room, token, { visibility: "public", isTemporary: true });
	}
}

export default function () {
	const token = getAuthToken();
	const room = rooms[Math.floor(Math.random() * rooms.length)];
	console.log(`User is joining room ${room}`);
	const url = `ws://${HOSTNAME}/api/room/${room}`;
	const res = ws.connect(url, null, function (socket) {
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
		socket.setTimeout(function () {
			socket.close(1000);
		}, 30000);
		socket.setInterval(function () {
			socket.send(
				JSON.stringify({
					action: "req",
					request: {
						type: 11,
						text: "foo",
					},
				})
			);
		}, 4000);
	});

	check(res, { "status is 101": r => r && r.status === 101 });
}
