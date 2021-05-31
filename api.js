const express = require('express');
const uuid = require("uuid/v4");
const _ = require("lodash");
import InfoExtract from "./server/infoextractor";
import { RoomRequestType } from "./common/models/messages";
const { getLogger } = require('./logger.js');
const permissions = require("./server/permissions.js");
const storage = require("./storage.js");
import roommanager from "./server/roommanager";
const { rateLimiter, handleRateLimit, setRateLimitHeaders } = require("./server/rate-limit");
import { QueueMode, Role, Visibility } from "./common/models/types";
import roomapi from "./server/api/room";
import clientmanager from "./server/clientmanager";
import { redisClient } from "./redisclient";
import { ANNOUNCEMENT_CHANNEL } from "./common/constants";

const log = getLogger("api");

const VALID_ROOM_VISIBILITY = [
	Visibility.Public,
	Visibility.Unlisted,
	Visibility.Private,
];

const VALID_ROOM_QUEUE_MODE = [
	QueueMode.Manual,
	QueueMode.Vote,
	QueueMode.Loop,
	QueueMode.Dj,
];

function handleGetRoomFailure(res, err) {
	if (err.name === "RoomNotFoundException") {
		res.status(404).json({
			success: false,
			error: {
				name: err.name,
				message: "Room not found",
			},
		});
	}
	else if (err.name === "PermissionDeniedException") {
		res.status(400).json({
			success: false,
			error: {
				name: err.name,
				message: err.message,
			},
		});
	}
	else {
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
	if (err.name === "VideoAlreadyQueuedException" || err.name === "PermissionDeniedException") {
		res.status(400).json({
			success: false,
			error: {
				name: err.name,
				message: err.message,
			},
		});
	}
	else {
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

router.use("/room", roomapi);
if (process.env.NODE_ENV === "development") {
	(async () => {
		router.use("/dev", (await import("./server/api/dev")).default);
	})();
}

router.get("/room/:name", async (req, res) => {
	try {
		let room = await roommanager.GetRoom(req.params.name);
		let hasOwner = !!room.owner;
		room = _.cloneDeep(_.pick(room, [
			"name",
			"title",
			"description",
			"isTemporary",
			"visibility",
			"queueMode",
			"queue",
			"users",
			"grants",
		]));
		room.permissions = room.grants;
		room.hasOwner = hasOwner;
		let users = [];
		for (let c of room.users) {
			let client = _.pick(c, ["username", "isLoggedIn"]);
			client.name = client.username;
			users.push(client);
		}
		room.clients = users;
		for (let video of room.queue) {
			delete video._lastVotesChanged;
			if (room.queueMode === "vote") {
				video.votes = video.votes ? video.votes.length : 0;
			}
			else {
				delete video.votes;
			}
		}
		res.json(room);
	}
	catch (e) {
		handleGetRoomFailure(res, e);
	}
});

router.post("/room/generate", async (req, res) => {
	try {
		let info = await rateLimiter.consume(req.ip, 50);
		setRateLimitHeaders(res, info);
	}
	catch (e) {
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
		}
		else {
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

router.patch("/room/:name", async (req, res) => {
	// FIXME: should send a room request to update the room settings
	let room;
	try {
		room = await roommanager.GetRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}
	let filtered = _.pick(req.body, [
		"title",
		"description",
		"visibility",
		"queueMode",
	]);
	filtered = _.pickBy(filtered, n => n !== null);
	if (filtered.visibility && !VALID_ROOM_VISIBILITY.includes(filtered.visibility)) {
		res.status(400).json({
			success: false,
			error: "Invalid value for room visibility",
		});
		return;
	}
	if (filtered.queueMode && !VALID_ROOM_QUEUE_MODE.includes(filtered.queueMode)) {
		res.status(400).json({
			success: false,
			error: "Invalid value for room queue mode",
		});
		return;
	}
	Object.assign(room, filtered);
	if (req.body.permissions) {
		room.setGrants(new permissions.Grants(req.body.permissions), req.session);
	}
	if (!room.isTemporary) {
		if (req.body.claim && !room.owner) {
			if (req.user) {
				room.owner = req.user;
				// HACK: force the room to send the updated user info to the client
				for (let user of room.realusers) {
					if (user.user_id === room.owner.id) {
						room.syncUser(room.getUserInfo(user.id));
						break;
					}
				}
			}
			else {
				res.status(401).json({
					success: false,
					error: {
						message: "Must be logged in to claim room ownership.",
					},
				});
				return;
			}
		}

		try {
			await storage.updateRoom(room);
			res.status(200).json({
				success: true,
			});
		}
		catch (err) {
			log.error(`Failed to update room: ${err} ${err.stack}`);
			res.status(500).json({
				success: false,
			});
			return;
		}
	}
	else {
		res.json({
			success: true,
		});
	}
});

router.delete("/room/:name", (req, res) => {
	roommanager.getOrLoadRoom(req.params.name).then(room => {
		roommanager.unloadRoom(room);
		res.json({
			success: true,
		});
	}).catch(err => handleGetRoomFailure(res, err));
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
		}
		catch (e) {
			if (e instanceof Error) {
				throw e;
			}
			else {
				handleRateLimit(res, e);
				return;
			}
		}
		room = await roommanager.GetRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		let client = clientmanager.getClient(req.session, req.params.name);
		// FIXME: what if the client is not connected to this node?
		let roomRequest = { type: RoomRequestType.AddRequest, client: client.id };
		if (req.body.videos) {
			roomRequest.videos = req.body.videos;
		}
		else if (req.body.url) {
			roomRequest.url = req.body.url;
		}
		else if (req.body.service && req.body.id) {
			roomRequest.video = { service: req.body.service, id: req.body.id };
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
			return;
		}
		await room.processRequest(roomRequest);
		res.json({
			success: true,
		});
	}
	catch (err) {
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
		}
		catch (e) {
			if (e instanceof Error) {
				throw e;
			}
			else {
				handleRateLimit(res, e);
				return;
			}
		}
		room = await roommanager.GetRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		let client = clientmanager.getClient(req.session, req.params.name);
		// FIXME: what if the client is not connected to this node?
		if (req.body.service && req.body.id) {
			await room.processRequest({ type: RoomRequestType.RemoveRequest, client: client.id, video: {service: req.body.service, id: req.body.id} });
			res.json({
				success: true,
			});
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
		}
	}
	catch (err) {
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
	}
	catch (e) {
		if (e instanceof Error) {
			throw e;
		}
		else {
			handleRateLimit(res, e);
			return;
		}
	}
	try {
		log.info(`Getting queue add preview for ${req.query.input}`);
		let result = await InfoExtract.resolveVideoQuery(req.query.input.trim(), process.env.SEARCH_PROVIDER);
		res.json(result);
		log.info(`Sent add preview response with ${result.length} items`);
	}
	catch (err) {
		if (err.name === "UnsupportedServiceException" || err.name === "InvalidAddPreviewInputException" || err.name === "OutOfQuotaException" || err.name === "InvalidVideoIdException" || err.name === "FeatureDisabledException" || err.name === "UnsupportedMimeTypeException" || err.name === "LocalFileException" || err.name === "MissingMetadataException" || err.name === "UnsupportedVideoType") {
			log.error(`Unable to get add preview: ${err.name}`);
			res.status(400).json({
				success: false,
				error: {
					name: err.name,
					message: err.message,
				},
			});
		}
		else {
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

router.get("/data/permissions", (req, res) => {
	const { ROLE_NAMES, ROLE_DISPLAY_NAMES, PERMISSIONS } = permissions;
	let roles = [
		Role.Owner,
		Role.Administrator,
		Role.Moderator,
		Role.TrustedUser,
		Role.RegisteredUser,
		Role.UnregisteredUser,
	].map(i => {
		return {
			id: i,
			name: ROLE_NAMES[i],
			display: ROLE_DISPLAY_NAMES[i],
		};
	});
	res.json({
		roles,
		permissions: PERMISSIONS,
	});
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
	}
	else {
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
		redisClient.publish(ANNOUNCEMENT_CHANNEL, JSON.stringify({
			action: "announcement",
			text: req.body.text,
		}));
	}
	catch (error) {
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
