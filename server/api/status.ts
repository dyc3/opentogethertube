import { getLogger } from "../logger.js";
import express from "express";
import roommanager from "../roommanager";
import { register } from "prom-client";

const router = express.Router();
const log = getLogger("api/status");

router.get("/", (req, res) => {
	res.json({
		status: "ok",
		counters: {
			rooms: roommanager.rooms.length,
		},
	});
});

router.get("/metrics", async (req, res) => {
	res.type("text/plain; version=0.0.4").send(await register.metrics());
});

export default router;
