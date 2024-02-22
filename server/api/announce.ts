import { getLogger } from "../logger";
import { conf } from "../ott-config";
import express, { RequestHandler } from "express";
import { redisClient } from "../redisclient";
import { ANNOUNCEMENT_CHANNEL } from "../../common/constants";
import { OttResponseBody } from "../../common/models/rest-api";
import { OttException } from "../../common/exceptions";
import { BadApiArgumentException } from "../exceptions";

const router = express.Router();
const log = getLogger("api/announce");

const announce: RequestHandler<unknown, OttResponseBody, { text: string }> = async (
	req,
	res,
	next
) => {
	if (req.get("apikey")) {
		if (req.get("apikey") !== conf.get("api_key")) {
			res.status(400).json({
				success: false,
				error: {
					name: "InvalidApiKey",
					message: "apikey is invalid",
				},
			});
			return;
		}
	} else {
		res.status(400).json({
			success: false,
			error: {
				name: "MissingApiKey",
				message: "apikey was not supplied",
			},
		});
		return;
	}
	if (!req.body.text) {
		throw new BadApiArgumentException("text", "missing");
	}

	try {
		await redisClient.publish(
			ANNOUNCEMENT_CHANNEL,
			JSON.stringify({
				action: "announcement",
				text: req.body.text,
			})
		);
	} catch (error) {
		log.error(`An unknown error occurred while sending an announcement: ${error}`);
		throw error;
	}
	res.json({
		success: true,
	});
};

router.post("/", async (req, res, next) => {
	try {
		await announce(req, res, next);
	} catch (e) {
		if (e instanceof OttException) {
			res.status(400).json({
				success: false,
				error: e,
			});
			return;
		} else {
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "Unknown, check logs",
				},
			});
		}
	}
});

export default router;
