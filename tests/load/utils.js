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
	let resp = http.post(url, body, {
		headers: {
			Authorization: `Bearer ${token}`,
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
