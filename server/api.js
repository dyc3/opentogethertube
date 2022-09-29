const express = require("express");
const uuid = require("uuid/v4");
const _ = require("lodash");
import InfoExtract from "./infoextractor";
import { RoomRequestType } from "../common/models/messages";
const { getLogger } = require("./logger.js");
import roommanager from "./roommanager";
const { rateLimiter, handleRateLimit, setRateLimitHeaders } = require("./rate-limit");
import { QueueMode } from "../common/models/types";
import roomapi from "./api/room";
import { redisClient } from "./redisclient";
import { ANNOUNCEMENT_CHANNEL } from "../common/constants";
import auth from "./auth";
import usermanager from "./usermanager";
import passport from "passport";
import statusapi from "./api/status";

const log = getLogger("api");

function handleGetRoomFailure(res, err) {
	if (err.name === "RoomNotFoundException") {
		res.status(404).json({
			success: false,
			error: {
				name: err.name,
				message: "Room not found",
			},
		});
	} else if (
		err.name === "PermissionDeniedException" ||
		err.name === "ClientNotFoundInRoomException"
	) {
		res.status(400).json({
			success: false,
			error: {
				name: err.name,
				message: err.message,
			},
		});
	} else {
		log.error(`Unhandled exception when getting room: ${err} ${err.stack}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "Failed to get room",
			},
		});
	}
}

function handlePostVideoFailure(res, err) {
	if (
		err.name === "VideoAlreadyQueuedException" ||
		err.name === "PermissionDeniedException" ||
		err.name === "ClientNotFoundInRoomException"
	) {
		log.warn(`Failed to post video: ${err.name}`);
		res.status(400).json({
			success: false,
			error: {
				name: err.name,
				message: err.message,
			},
		});
	} else {
		log.error(`Unhandled exception when getting video: ${err} ${err.stack}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "Failed to get video",
			},
		});
	}
}

const router = express.Router();

router.use("/auth", auth.router);
router.use("/status", statusapi);
router.use((req, res, next) => {
	// eslint-disable-next-line no-unused-vars
	passport.authenticate("bearer", (err, user, info) => {
		// We are intentionally ignoring the case where authentication fails, because
		// we want to allow users who are not logged in to an actual account to
		// be able to use the website.

		// log.error(`bearer auth error: ${err}`);
		if (err) {
			next(err);
			return;
		}
		// log.debug(`bearer auth user: ${user}`);
		// log.debug(`bearer auth info: ${info}`);
		next();
	})(req, res, next);
});
router.use(auth.authTokenMiddleware);
router.use("/user", usermanager.router);
router.use("/room", roomapi);

if (process.env.NODE_ENV === "development") {
	(async () => {
		router.use("/dev", (await import("./api/dev")).default);
	})();
}

router.get("/room/:name", async (req, res) => {
	try {
		let room = await roommanager.GetRoom(req.params.name);
		let hasOwner = !!room.owner;
		room = _.cloneDeep(
			_.pick(room, [
				"name",
				"title",
				"description",
				"isTemporary",
				"visibility",
				"queueMode",
				"queue",
				"users",
				"grants",
				"autoSkipSegments",
			])
		);
		room.permissions = room.grants;
		room.hasOwner = hasOwner;
		let users = [];
		for (let c of room.users) {
			let client = _.pick(c, ["username", "isLoggedIn"]);
			client.name = client.username;
			users.push(client);
		}
		room.clients = users;
		for (let video of room.queue.items) {
			delete video._lastVotesChanged;
			if (room.queueMode === QueueMode.Vote) {
				video.votes = video.votes ? video.votes.length : 0;
			} else {
				delete video.votes;
			}
		}
		res.json(room);
	} catch (e) {
		handleGetRoomFailure(res, e);
	}
});

router.post("/room/generate", async (req, res) => {
	try {
		let info = await rateLimiter.consume(req.ip, 50);
		setRateLimitHeaders(res, info);
	} catch (e) {
		if (e instanceof Error) {
			log.error(`Unable to generate room: ${e} ${e.message}`);
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "An unknown error occured when creating this room. Try again later.",
				},
			});
			return;
		} else {
			handleRateLimit(res, e);
			return;
		}
	}
	let roomName = uuid();
	log.debug(`Generating room: ${roomName}`);
	await roommanager.CreateRoom({
		name: roomName,
		isTemporary: true,
	});
	log.info(`room generated: ip=${req.ip} user-agent=${req.headers["user-agent"]}`);
	res.json({
		success: true,
		room: roomName,
	});
});

router.delete("/room/:name", (req, res) => {
	roommanager
		.getOrLoadRoom(req.params.name)
		.then(room => {
			roommanager.unloadRoom(room);
			res.json({
				success: true,
			});
		})
		.catch(err => handleGetRoomFailure(res, err));
});

router.post("/room/:name/queue", async (req, res) => {
	let room;
	try {
		let points = 5;
		if (req.body.videos) {
			points = 3 * req.body.videos.length;
		}
		try {
			let info = await rateLimiter.consume(req.ip, points);
			setRateLimitHeaders(res, info);
		} catch (e) {
			if (e instanceof Error) {
				throw e;
			} else {
				handleRateLimit(res, e);
				return;
			}
		}
		room = await roommanager.GetRoom(req.params.name);
	} catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		let roomRequest = { type: RoomRequestType.AddRequest };
		if (req.body.videos) {
			roomRequest.videos = req.body.videos;
		} else if (req.body.url) {
			roomRequest.url = req.body.url;
		} else if (req.body.service && req.body.id) {
			roomRequest.video = { service: req.body.service, id: req.body.id };
		} else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
			return;
		}
		await room.processUnauthorizedRequest(roomRequest, { token: req.token });
		res.json({
			success: true,
		});
	} catch (err) {
		handlePostVideoFailure(res, err);
	}
});

router.delete("/room/:name/queue", async (req, res) => {
	let room;
	try {
		let points = 5;
		try {
			let info = await rateLimiter.consume(req.ip, points);
			setRateLimitHeaders(res, info);
		} catch (e) {
			if (e instanceof Error) {
				throw e;
			} else {
				handleRateLimit(res, e);
				return;
			}
		}
		room = await roommanager.GetRoom(req.params.name);
	} catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		if (req.body.service && req.body.id) {
			await room.processUnauthorizedRequest(
				{
					type: RoomRequestType.RemoveRequest,
					video: { service: req.body.service, id: req.body.id },
				},
				{ token: req.token }
			);
			res.json({
				success: true,
			});
		} else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
		}
	} catch (err) {
		handlePostVideoFailure(res, err);
	}
});

router.get("/data/previewAdd", async (req, res) => {
	let points = 5;
	try {
		if (!InfoExtract.isURL(req.query.input)) {
			points *= 15;
		}
		let info = await rateLimiter.consume(req.ip, points);
		setRateLimitHeaders(res, info);
	} catch (e) {
		if (e instanceof Error) {
			throw e;
		} else {
			handleRateLimit(res, e);
			return;
		}
	}
	try {
		log.info(`Getting queue add preview for ${req.query.input}`);
		let result = await InfoExtract.resolveVideoQuery(
			req.query.input.trim(),
			process.env.SEARCH_PROVIDER
		);
		res.json(result);
		log.info(`Sent add preview response with ${result.length} items`);
	} catch (err) {
		if (
			err.name === "UnsupportedServiceException" ||
			err.name === "InvalidAddPreviewInputException" ||
			err.name === "OutOfQuotaException" ||
			err.name === "InvalidVideoIdException" ||
			err.name === "FeatureDisabledException" ||
			err.name === "UnsupportedMimeTypeException" ||
			err.name === "LocalFileException" ||
			err.name === "MissingMetadataException" ||
			err.name === "UnsupportedVideoType" ||
			err.name === "VideoNotFoundException"
		) {
			log.error(`Unable to get add preview: ${err.name}`);
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		} else {
			log.error(`Unable to get add preview: ${err} ${err.stack}`);
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "Unknown error occurred.",
				},
			});
		}
	}
});

router.post("/announce", (req, res) => {
	if (req.get("apikey")) {
		if (req.get("apikey") !== process.env.OPENTOGETHERTUBE_API_KEY) {
			res.status(400).json({
				success: false,
				error: "apikey is invalid",
			});
			return;
		}
	} else {
		res.status(400).json({
			success: false,
			error: "apikey was not supplied",
		});
		return;
	}
	if (!req.body.text) {
		res.status(400).json({
			success: false,
			error: "text was not supplied",
		});
		return;
	}

	try {
		redisClient.publish(
			ANNOUNCEMENT_CHANNEL,
			JSON.stringify({
				action: "announcement",
				text: req.body.text,
			})
		);
	} catch (error) {
		log.error(`An unknown error occurred while sending an announcement: ${error}`);
		res.status(500).json({
			success: false,
			error: {
				name: "Unknown",
				message: "Unknown, check logs",
			},
		});
		return;
	}
	res.json({
		success: true,
	});
});

module.exports = router;
