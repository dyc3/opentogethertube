const express = require('express');
const uuid = require("uuid/v4");
const _ = require("lodash");
const InfoExtract = require("./server/infoextractor");
const { getLogger } = require('./logger.js');
const permissions = require("./server/permissions.js");
const storage = require("./storage.js");
import roommanager from "./server/roommanager";
import { RoomOptions } from "./server/room";
const { rateLimiter, handleRateLimit, setRateLimitHeaders } = require("./server/rate-limit.js");

const log = getLogger("api");

// These strings are not allowed to be used as room names.
const RESERVED_ROOM_NAMES = [
	"list",
	"create",
	"generate",
];

const VALID_ROOM_VISIBILITY = [
	"public",
	"unlisted",
	"private",
];

const VALID_ROOM_QUEUE_MODE = [
	"manual",
	"vote",
	"loop",
	"dj",
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

router.get("/room/list", (req, res) => {
	let isAuthorized = req.get("apikey") === process.env.OPENTOGETHERTUBE_API_KEY;
	if (req.get("apikey") && !isAuthorized) {
		res.status(400).json({
			success: false,
			error: "apikey is invalid",
		});
		return;
	}
	let rooms = [];
	for (const room of roommanager.rooms) {
		if (room.visibility !== "public" && !isAuthorized) {
			continue;
		}
		let obj = {
			name: room.name,
			title: room.title,
			description: room.description,
			isTemporary: room.isTemporary,
			visibility: room.visibility,
			queueMode: room.queueMode,
			currentSource: room.currentSource,
			users: room.clients.length,
		};
		if (isAuthorized) {
			obj.queueLength = room.queue.length;
			obj.isPlaying = room.isPlaying;
			obj.playbackPosition = room.playbackPosition;
			obj.clients = room.clients.map(client => {
				return {
					username: client.username,
					isLoggedIn: client.isLoggedIn,
					ip: client.req_ip,
					forward_ip: client.req_forward_ip,
				};
			});
		}
		rooms.push(obj);
	}
	rooms = _.orderBy(rooms, ["users", "name"], ["desc", "asc"]);
	res.json(rooms);
});

router.get("/room/:name", async (req, res) => {
	try {
		let room = await roommanager.getOrLoadRoom(req.params.name);
		let hasOwner = !!room.owner;
		room = _.cloneDeep(_.pick(room, [
			"name",
			"title",
			"description",
			"isTemporary",
			"visibility",
			"queueMode",
			"queue",
			"clients",
			"permissions",
		]));
		room.hasOwner = hasOwner;
		let clients = [];
		for (let c of room.clients) {
			let client = _.pick(c, ["username", "isLoggedIn"]);
			client.name = client.username;
			clients.push(client);
		}
		room.clients = clients;
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

router.post("/room/create", async (req, res) => {
	if (!req.body.name) {
		log.info(req.body);
		res.status(400).json({
			success: false,
			error: {
				message: "Missing argument (name)",
			},
		});
		return;
	}
	if (RESERVED_ROOM_NAMES.includes(req.body.name)) {
		res.status(400).json({
			success: false,
			error: {
				message: "Room name not allowed (reserved)",
			},
		});
		return;
	}
	if (req.body.name.length < 3) {
		res.status(400).json({
			success: false,
			error: {
				message: "Room name not allowed (too short, must be at least 3 characters)",
			},
		});
		return;
	}
	if (req.body.name.length > 32) {
		res.status(400).json({
			success: false,
			error: {
				message: "Room name not allowed (too long, must be at most 32 characters)",
			},
		});
		return;
	}
	if (!(/^[A-za-z0-9_-]+$/).exec(req.body.name)) {
		res.status(400).json({
			success: false,
			error: {
				message: "Room name not allowed (invalid characters)",
			},
		});
		return;
	}
	if (req.body.visibility && !VALID_ROOM_VISIBILITY.includes(req.body.visibility)) {
		res.status(400).json({
			success: false,
			error: {
				message: "Invalid value for room visibility",
			},
		});
		return;
	}
	let points = 50;
	if (!req.body.temporary) {
		req.body.temporary = false;
		points *= 4;
	}
	if (!req.body.visibility) {
		req.body.visibility = "public";
	}
	try {
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
		if (req.user) {
			await roommanager.CreateRoom({ ...req.body, owner: req.user });
		}
		else {
			await roommanager.CreateRoom(req.body);
		}
		log.info(`${req.body.temporary ? "Temporary" : "Permanent"} room created: name=${req.body.name} ip=${req.ip} user-agent=${req.headers["user-agent"]}`);
		res.json({
			success: true,
		});
	}
	catch (e) {
		if (e.name === "RoomNameTakenException") {
			res.status(400).json({
				success: false,
				error: {
					name: e.name,
					message: "Room with that name already exists",
				},
			});
		}
		else {
			log.error(`Unable to create room: ${e} ${e.message}`);
			res.status(500).json({
				success: false,
				error: {
					name: "Unknown",
					message: "An unknown error occured when creating this room. Try again later.",
				},
			});
		}
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
	let room;
	try {
		room = await roommanager.getOrLoadRoom(req.params.name);
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
			log.error(`Failed to update room: ${err} ${err.message}`);
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
		room = await roommanager.getOrLoadRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		let success;
		if (req.body.videos) {
			success = await room.addManyToQueue(req.body.videos, req.session);
		}
		else if (req.body.url) {
			success = await room.addToQueue({ url: req.body.url }, req.session);
		}
		else if (req.body.service && req.body.id) {
			success = await room.addToQueue({ service: req.body.service, id: req.body.id }, req.session);
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
			return;
		}
		res.json({
			success,
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
		room = await roommanager.getOrLoadRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}

	try {
		let success;
		if (req.body.service && req.body.id) {
			success = room.removeFromQueue({ service: req.body.service, id: req.body.id }, req.session);
		}
		else if (req.body.url) {
			success = room.removeFromQueue({ url: req.body.url }, req.session);
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
			return;
		}
		res.json({
			success,
		});
	}
	catch (err) {
		handlePostVideoFailure(res, err);
	}
});

router.post("/room/:name/vote", (req, res) => {
	roommanager.getOrLoadRoom(req.params.name).then(room => {
		if (req.body.service && req.body.id) {
			let success = room.voteVideo({ service: req.body.service, id: req.body.id }, req.session);
			res.json({
				success,
			});
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
		}
	}).catch(err => handleGetRoomFailure(res, err));
});

router.delete("/room/:name/vote", (req, res) => {
	roommanager.getOrLoadRoom(req.params.name).then(room => {
		if (req.body.service && req.body.id) {
			let success = room.removeVoteVideo({ service: req.body.service, id: req.body.id }, req.session);
			res.json({
				success,
			});
		}
		else {
			res.status(400).json({
				success: false,
				error: "Invalid parameters",
			});
		}
	}).catch(err => handleGetRoomFailure(res, err));
});

router.post("/room/:name/undo", (req, res) => {
	roommanager.getOrLoadRoom(req.params.name).then(room => {
		room.undoEvent(req.body.event);
	}).catch(err => handleGetRoomFailure(res, err));
});

router.post("/room/:name/play", async (req, res) => {
	let room;
	try {
		let points = 1;
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
		room = await roommanager.getOrLoadRoom(req.params.name);
	}
	catch (err) {
		handleGetRoomFailure(res, err);
		return;
	}
	// if (req.body.index) {

	// }
	// else {
	let client = room.getClient(req.session);
	room.play(client);
	// }
	res.json({success: true});
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
		if (err.name === "UnsupportedServiceException" || err.name === "InvalidAddPreviewInputException" || err.name === "OutOfQuotaException" || err.name === "InvalidVideoIdException" || err.name === "FeatureDisabledException" || err.name === "UnsupportedMimeTypeException" || err.name === "LocalFileException" || err.name === "MissingMetadataException") {
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
	const { ROLES, ROLE_NAMES, ROLE_DISPLAY_NAMES, PERMISSIONS } = permissions;
	let roles = _.values(ROLES).map(i => {
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
	if (req.body.apikey) {
		if (req.body.apikey !== process.env.OPENTOGETHERTUBE_API_KEY) {
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
		roommanager.sendAnnouncement(req.body.text);
	}
	catch (error) {
		log.error(`An unknown error occurred while sending an announcement: ${error}`);
		res.status(500).json({
			success: false,
			error: "Unknown, check logs",
		});
		return;
	}
	res.json({
		success: true,
	});
});

module.exports = router;
