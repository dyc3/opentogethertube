import { getLogger } from "../logger.js";
import express from "express";
import { rateLimiter } from "../rate-limit";
import roommanager from "../roommanager";
import { RoomRequestType } from "../../common/models/messages";
import usermanager from "../usermanager";
import faker from "faker";
import tokens from "../auth/tokens";
import { setApiKey } from "../admin";

const router = express.Router();
const log = getLogger("api/dev");

router.post("/reset-rate-limit", async (req, res) => {
	await rateLimiter.delete(req.ip);
	log.warn(`Reset rate limit for: ${req.ip}`);
	res.json({ success: true });
});

router.post("/reset-rate-limit/user", async (req, res) => {
	await usermanager.clearAllRateLimiting();
	log.warn(`Reset all user manager rate limits`);
	res.json({ success: true });
});

router.post("/room/:name/add-fake-user", async (req, res) => {
	let user;
	const token = await tokens.mint();
	if (req.body.register) {
		user = await usermanager.registerUser({
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		});
		await tokens.setSessionInfo(token, { isLoggedIn: true, user_id: user.id });
	} else {
		await tokens.setSessionInfo(token, { isLoggedIn: false, username: "fake_user" });
	}

	const result = await roommanager.getRoom(req.params.name);
	if (!result.ok) {
		res.json({
			success: false,
			error: {
				name: "RoomNotFound",
				message: "Room not found",
			},
		});
		return;
	}
	const room = result.value;
	try {
		await room.processUnauthorizedRequest(
			{
				type: RoomRequestType.JoinRequest,
				info: {
					id: "fake",
					user_id: user ? user.id : undefined,
				},
			},
			{ token: token }
		);
		res.json({ success: true });
	} catch (e) {
		res.json({
			success: false,
			error: {
				name: e.name,
				message: e.message,
			},
		});
	}
});

router.post("/set-admin-api-key", (req, res) => {
	setApiKey(req.body.newkey);
	res.json({ success: true });
});

export default router;
