import express from "express";
import _ from "lodash";
import { getLogger } from '../../logger.js';
import roommanager from "../roommanager";
import { Visibility } from "../types";

const router = express.Router();
const log = getLogger("api/room");

router.get("/list", (req, res) => {
	const isAuthorized = req.get("apikey") === process.env.OPENTOGETHERTUBE_API_KEY;
	if (req.get("apikey") && !isAuthorized) {
		log.warn(`Unauthorized request to room list endpoint: ip=${req.ip} forward-ip=${req.headers["x-forwarded-for"]} user-agent=${req.headers["user-agent"]}`);
		res.status(400).json({
			success: false,
			error: "apikey is invalid",
		});
		return;
	}
	let rooms = [];
	for (const room of roommanager.rooms) {
		if (room.visibility !== Visibility.Public && !isAuthorized) {
			continue;
		}
		const obj = {
			name: room.name,
			title: room.title,
			description: room.description,
			isTemporary: room.isTemporary,
			visibility: room.visibility,
			queueMode: room.queueMode,
			currentSource: room.currentSource,
			users: room.users.length,
		};
		// if (isAuthorized) {
		// 	obj.queueLength = room.queue.length;
		// 	obj.isPlaying = room.isPlaying;
		// 	obj.playbackPosition = room.playbackPosition;
		// 	obj.clients = room.clients.map(client => {
		// 		return {
		// 			username: client.username,
		// 			isLoggedIn: client.isLoggedIn,
		// 			ip: client.req_ip,
		// 			forward_ip: client.req_forward_ip,
		// 		};
		// 	});
		// }
		rooms.push(obj);
	}
	rooms = _.orderBy(rooms, ["users", "name"], ["desc", "asc"]);
	res.json(rooms);
});

export default router;
