import express from "express";
import { register } from "prom-client";
import { getLogger } from "../logger.js";

const router = express.Router();
// biome-ignore lint/correctness/noUnusedVariables: biome migration
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
