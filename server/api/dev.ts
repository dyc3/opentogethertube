import { getLogger } from '../../logger.js';
import express from "express";
import { rateLimiter } from "../rate-limit";
import roommanager from "../roommanager";
import { RoomRequestType } from '../../common/models/messages';
import usermanager from '../../usermanager.js';
import faker from "faker";

const router = express.Router();
const log = getLogger("api/dev");

router.post("/reset-rate-limit", async (req, res) => {
	await rateLimiter.delete(req.ip);
	log.warn(`Reset rate limit for: ${req.ip}`);
	res.json({ success: true });
});

router.post("/room/:name/add-fake-user", async (req, res) => {
	let user;
	if (req.body.register) {
		user = await usermanager.registerUser({
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		});
	}

	const room = await roommanager.GetRoom(req.params.name);
	await room.processRequest({
		type: RoomRequestType.JoinRequest,
		client: "fake",
		info: {
			id: "fake",
			user_id: user ? user.id : undefined,
		},
	});
	res.json({ success: true });
});

export default router;
