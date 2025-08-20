import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { check, sleep } from "k6";
import ws from "k6/ws";
import { createRoom, getAuthToken, HOSTNAME } from "./utils.js";

export const options = {
	rate: 50,
	duration: "1h",
};

export function setup() {
	const rooms = [];
	for (let i = 0; i < 50; i++) {
		rooms.push(`load-test-${i}`);
	}

	const token = getAuthToken();
	for (let room of rooms) {
		createRoom(room, token, { visibility: "public", isTemporary: true });
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
	console.log(`User is joining room ${room}`);
	const url = `ws://${HOSTNAME}/api/room/${room}`;

	const res = ws.connect(url, null, socket => {
		socket.on("open", () => {
			socket.send(JSON.stringify({ action: "auth", token: token }));
			socket.close(1000);
		});
	});
	check(res, { "ws status is 101": r => r && r.status === 101 });
}
