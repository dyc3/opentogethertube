import { getLogger } from "../logger.js";
import express from "express";
import { register } from "prom-client";

const router = express.Router();
const _log = getLogger("api/status");

router.get("/", (_req, res) => {
	res.json({
		status: "ok",
	});
});

router.get("/metrics", async (_req, res) => {
	res.type("text/plain; version=0.0.4").send(await register.metrics());
});

export default router;
