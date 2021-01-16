const express = require('express');
const rateLimit = require("express-rate-limit");
const RateLimitStore = require('rate-limit-redis');
const uuid = require("uuid/v4");
const _ = require("lodash");
const InfoExtract = require("./server/infoextractor");
const { getLogger } = require('./logger.js');
const { redisClient } = require('./redisclient.js');

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
];

const VALID_ROOM_TOOLTIP = [
	"none",
	"timestamp",
];

function handleGetRoomFailure(res, err) {
	if (err.name === "RoomNotFoundException") {
		res.status(404).json({
			success: false,
			error: "Room not found",
		});
	}
	else {
		log.error("Unhandled exception when getting room:", err);
		res.status(500).json({
			success: false,
			error: "Failed to get room",
		});
	}
}

function handlePostVideoFailure(res, err) {
	if (err.name === "VideoAlreadyQueuedException") {
		res.status(400).json({
			success: false,
			error: err.message,
		});
	}
	else {
		log.error("Unhandled exception when getting video:", err);
		res.status(500).json({
			success: false,
			error: "Failed to get video",
		});
	}
}

// eslint-disable-next-line no-unused-vars
module.exports = function(_roommanager, storage) {
	const roommanager = _roommanager;
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
			rooms.push({
				name: room.name,
				title: room.title,
				description: room.description,
				isTemporary: room.isTemporary,
				visibility: room.visibility,
				currentSource: room.currentSource,
				users: room.clients.length,
			});
		}
		rooms = _.sortBy(_.sortBy(rooms, "name").reverse(), "users").reverse();
		res.json(rooms);
	});

	router.get("/room/:name", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			let hasOwner = !!room.owner;
			room = _.cloneDeep(_.pick(room, [
				"name",
				"title",
				"description",
				"isTemporary",
				"visibility",
				"queueMode",
				"tooltip",
				"queue",
				"clients",
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
		}).catch(err => handleGetRoomFailure(res, err));
	});

	let createRoomLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:RoomCreate" }), windowMs: 60 * 60 * 1000, max: 4, message: "You are creating too many rooms. Please try again later." });
	router.post("/room/create", process.env.NODE_ENV === "production" ? createRoomLimiter : (req, res, next) => next(), async (req, res) => {
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
		if (!req.body.temporary) {
			req.body.temporary = false;
		}
		if (!req.body.visibility) {
			req.body.visibility = "public";
		}
		try {
			if (req.user) {
				await roommanager.createRoom({ ...req.body, owner: req.user });
			}
			else {
				await roommanager.createRoom(req.body);
			}
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

	router.post("/room/generate", process.env.NODE_ENV === "production" ? createRoomLimiter : (req, res, next) => next(), async (req, res) => {
		let roomName = uuid();
		log.debug(`Generating room: ${roomName}`);
		await roommanager.createRoom(roomName, true);
		res.json({
			success: true,
			room: roomName,
		});
	});

	router.patch("/room/:name", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			let filtered = _.pick(req.body, [
				"title",
				"description",
				"visibility",
				"queueMode",
				"tooltip",
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
			if (filtered.tooltip && !VALID_ROOM_TOOLTIP.includes(filtered.tooltip)) {
				res.status(400).json({
					success: false,
					error: "Invalid value for tooltip",
				});
				return;
			}
			Object.assign(room, filtered);
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

				storage.updateRoom(room).then(success => {
					res.status(success ? 200 : 500).json({
						success,
					});
				}).catch(err => {
					log.error(`Failed to update room: ${err} ${err.message}`);
					res.status(500).json({
						success: false,
					});
				});
			}
			else {
				res.json({
					success: true,
				});
			}
		}).catch(err => handleGetRoomFailure(res, err));
	});

	router.delete("/room/:name", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			roommanager.unloadRoom(room);
			res.json({
				success: true,
			});
		}).catch(err => handleGetRoomFailure(res, err));
	});

	let addToQueueLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:QueueAdd" }), windowMs: 30 * 1000, max: 30, message: "Wait a little bit longer before adding more videos." });
	router.post("/room/:name/queue", process.env.NODE_ENV === "production" ? addToQueueLimiter : (req, res, next) => next(), (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			if (req.body.videos) {
				room.addManyToQueue(req.body.videos, req.session).then(success => {
					res.json({
						success,
					});
				});
			}
			else if (req.body.url) {
				room.addToQueue({ url: req.body.url }, req.session).then(success => {
					res.json({
						success,
					});
				}).catch(err => handlePostVideoFailure(res, err));
			}
			else if (req.body.service && req.body.id) {
				room.addToQueue({ service: req.body.service, id: req.body.id }, req.session).then(success => {
					res.json({
						success,
					});
				}).catch(err => handlePostVideoFailure(res, err));
			}
			else {
				res.status(400).json({
					success: false,
					error: "Invalid parameters",
				});
			}
		}).catch(err => handleGetRoomFailure(res, err));
	});

	let removeFromQueueLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:QueueRemove" }), windowMs: 30 * 1000, max: 30, message: "Wait a little bit longer before removing more videos." });
	router.delete("/room/:name/queue", process.env.NODE_ENV === "production" ? removeFromQueueLimiter : (req, res, next) => next(), (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			if (req.body.service && req.body.id) {
				const success = room.removeFromQueue(req.body.service === "direct" ? { service: req.body.service, url: req.body.id } : { service: req.body.service, id: req.body.id }, req.session);
				res.json({
					success,
				});
			}
			else if (req.body.url) {
				const success = room.removeFromQueue({ url: req.body.url }, req.session);
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

	let addPreviewLimiter = rateLimit({ store: new RateLimitStore({ client: redisClient, resetExpiryOnChange: true, prefix: "rl:AddPreview" }), windowMs: 40 * 1000, max: 20, message: "Wait a little bit longer before requesting more add previews." });
	router.get("/data/previewAdd", process.env.NODE_ENV === "production" ? addPreviewLimiter : (req, res, next) => next(), (req, res) => {
		log.info(`Getting queue add preview for ${req.query.input}`);
		InfoExtract.resolveVideoQuery(req.query.input.trim(), "youtube").then(result => {
			res.json(result);
			log.info(`Sent add preview response with ${result.length} items`);
		}).catch(err => {
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
				log.error(`Unable to get add preview: ${err}`);
				res.status(500).json({
					success: false,
					error: {
						name: "Unknown",
						message: "Unknown error occurred.",
					},
				});
			}
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

	return router;
};
