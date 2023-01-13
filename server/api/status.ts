import { getLogger } from "../logger.js";
import express from "express";
import { register } from "prom-client";

const router = express.Router();
const log = getLogger("api/status");

router.get("/", (req, res) => {
	res.json({
		status: "ok",
	});
});

router.get("/metrics", async (req, res) => {
	res.type("text/plain; version=0.0.4").send(await register.metrics());
});

export default router;
