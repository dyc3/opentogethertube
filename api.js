const express = require('express');
const uuid = require("uuid/v4");
const _ = require("lodash");
const InfoExtract = require("./infoextract");
const { getLogger } = require('./logger.js');

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

// eslint-disable-next-line no-unused-vars
module.exports = function(_roommanager, storage) {
	const roommanager = _roommanager;
	const router = express.Router();

	router.get("/room/list", (req, res) => {
		let rooms = [];
		for (const room of roommanager.rooms) {
			if (room.visibility !== "public") {
				continue;
			}
			rooms.push({
				name: room.name,
				description: room.description,
				isTemporary: room.isTemporary,
				currentSource: room.currentSource,
				users: room.clients.length,
			});
		}
		res.json(rooms);
	});

	router.get("/room/:name", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			room = _.cloneDeep(room);
			for (let client of room.clients) {
				client.name = client.session.username;
				delete client.session;
				delete client.socket;
			}
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
		}).catch(err => {
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
		});
	});

	router.post("/room/create", (req, res) => {
		if (!req.body.name) {
			log.info(req.body);
			res.status(400).json({
				success: false,
				error: "Missing argument (name)",
			});
			return;
		}
		if (RESERVED_ROOM_NAMES.includes(req.body.name)) {
			res.status(400).json({
				success: false,
				error: "Room name not allowed (reserved)",
			});
			return;
		}
		if (req.body.name.length < 3) {
			res.status(400).json({
				success: false,
				error: "Room name not allowed (too short, must be at least 3 characters)",
			});
			return;
		}
		if (!(/^[A-za-z0-9_-]+$/).exec(req.body.name)) {
			res.status(400).json({
				success: false,
				error: "Room name not allowed (invalid characters)",
			});
			return;
		}
		if (req.body.visibility && !VALID_ROOM_VISIBILITY.includes(req.body.visibility)) {
			res.status(400).json({
				success: false,
				error: "Invalid value for room visibility",
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
			roommanager.createRoom(req.body.name, req.body.temporary, req.body.visibility);
			res.json({
				success: true,
			});
		}
		catch (e) {
			if (e.name === "RoomNameTakenException") {
				res.status(400).json({
					success: false,
					error: "Room with that name already exists",
				});
			}
			else {
				res.status(500).json({
					success: false,
					error: "An unknown error occured when creating this room. Try again later.",
				});
			}
		}
	});

	router.post("/room/generate", (req, res) => {
		let roomName = uuid();
		roommanager.createRoom(roomName, true);
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
			if (!room.isTemporary) {
				storage.updateRoom(room).then(success => {
					res.status(success ? 200 : 500).json({
						success,
					});
				}).catch(() => {
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
		}).catch(err => {
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
		});
	});

	router.delete("/room/:name", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			roommanager.unloadRoom(room);
			res.json({
				success: true,
			});
		}).catch(err => {
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
		});
	});

	router.post("/room/:name/queue", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			if (req.body.url) {
				room.addToQueue({ url: req.body.url }, req.session).then(success => {
					res.json({
						success,
					});
				});
			}
			else if (req.body.service && req.body.id) {
				room.addToQueue({ service: req.body.service, id: req.body.id }, req.session).then(success => {
					res.json({
						success,
					});
				});
			}
			else {
				res.status(400).json({
					success: false,
					error: "Invalid parameters",
				});
			}
		}).catch(err => {
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
		});
	});

	router.delete("/room/:name/queue", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			if (req.body.service && req.body.id) {
				const success = room.removeFromQueue({ service: req.body.service, id: req.body.id }, req.session);
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
		}).catch(err => {
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
		});
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
		}).catch(err => {
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
		});
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
		}).catch(err => {
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
		});
	});

	router.post("/room/:name/undo", (req, res) => {
		roommanager.getOrLoadRoom(req.params.name).then(room => {
			room.undoEvent(req.body.event);
		}).catch(err => {
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
		});
	});

	router.get("/data/previewAdd", (req, res) => {
		// FIXME: this endpoint has the potential to be abused.
		// TODO: rate limit

		log.info("Getting queue add preview for", req.query.input);
		try {
			InfoExtract.getAddPreview(req.query.input.trim(), { fromUser: req.ip }).then(result => {
				res.json(result);
				log.info("Sent add preview response with", result.length, "items");
			});
		}
		catch (error) {
			if (error.name === "UnsupportedServiceException" || error.name === "InvalidAddPreviewInputException" || error.name === "OutOfQuotaException") {
				log.error("Unable to get add preview:", error.name);
				res.status(400).json({
					success: false,
					error: error.message,
				});
			}
			else {
				log.error("Unable to get add preview:", error);
				res.status(500).json({
					success: false,
					error: "Unknown error occurred.",
				});
			}
		}
	});

	router.get("/user", (req, res) => {
		res.json({
			name: req.session.username,
		});
	});

	return router;
};
