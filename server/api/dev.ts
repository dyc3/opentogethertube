import { getLogger } from '../../logger.js';
import express from "express";
import { rateLimiter } from "../rate-limit";

const router = express.Router();
const log = getLogger("api/room");

router.post("/reset-rate-limit", async (req, res) => {
	await rateLimiter.delete(req.ip);
	log.warn(`Reset rate limit for: ${req.ip}`);
	res.json({ success: true });
});

export default router;
