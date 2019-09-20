const express = require('express');
const _ = require("lodash");
const uuid = require("uuid/v4");
const InfoExtract = require("./infoextract");

// eslint-disable-next-line no-unused-vars
module.exports = function(_roommanager, storage) {
	const roommanager = _roommanager;
	const router = express.Router();

	router.get("/room/list", (req, res) => {
		let roomNames = _.keys(roommanager.rooms);
		let rooms = [];
		for (let i = 0; i < roomNames.length; i++) {
			let room = roommanager.rooms[roomNames[i]];
			rooms.push({
				name: roomNames[i],
				description: room.description,
				isTemporary: room.isTemporary,
				currentSource: room.currentSource,
				users: room.clients.length,
			});
		}
		res.json(rooms);
	});

	router.get("/room/:name", (req, res) => {
		roommanager.getRoom(req.params.name).then(room => {
			if (room) {
				res.json(room);
			}
			else {
				res.status(500).json({
					success: false,
					error: "Failed to get room",
				});
			}
		});
	});

	router.post("/room/create", (req, res) => {
		if (!req.body.name) {
			console.log(req.body);
			res.status(400).json({
				success: false,
				error: "Missing argument (name)",
			});
			return;
		}
		if (req.body.name == "list") {
			res.status(400).json({
				success: false,
				error: "Room name not allowed (reserved)",
			});
			return;
		}
		if (roommanager.rooms[req.body.name] != undefined) {
			// already exists
			res.status(400).json({
				success: false,
				error: "Room with that name already exists",
			});
			return;
		}
		roommanager.createRoom(req.body.name);
		res.json({
			success: true,
		});
	});

	router.post("/room/generate", (req, res) => {
		let roomName = uuid();
		roommanager.createRoom(roomName, true);
		res.json({
			success: true,
			room: roomName,
		});
	});

	router.delete("/room/:name", (req, res) => {
		if (roommanager.rooms[req.params.name] == undefined) {
			res.status(400).json({
				success: false,
				error: "Room does not exist",
			});
			return;
		}
		roommanager.deleteRoom(req.params.name);
		res.status(200).json({
			success: true,
		});
	});

	router.post("/room/:name/queue", (req, res) => {
		if (!roommanager.rooms.hasOwnProperty(req.params.name)) {
			res.status(404);
			res.json({
				error: "Room does not exist",
			});
			return;
		}
		if (req.body.url) {
			roommanager.addToQueue(req.params.name, { url: req.body.url }).then(success => {
				res.json({
					success,
				});
			});
		}
		else if (req.body.service && req.body.id) {
			roommanager.addToQueue(req.params.name, { service: req.body.service, id: req.body.id }).then(success => {
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
			return;
		}
		roommanager.updateRoom(roommanager.rooms[req.params.name]);
	});

	router.delete("/room/:name/queue", (req, res) => {
		if (!roommanager.rooms.hasOwnProperty(req.params.name)) {
			res.status(404);
			res.json({
				success: false,
				error: "Room does not exist",
			});
			return;
		}

		// find the index of the item to delete
		let room = roommanager.rooms[req.params.name];
		let matchIdx = -1;
		for (let i = 0; i < room.queue.length; i++) {
			let item = room.queue[i];
			if (item.service === req.body.service && item.id === req.body.id) {
				matchIdx = i;
				break;
			}
		}

		if (matchIdx < 0) {
			res.status(404).json({
				success: false,
				error: "Queue item not found",
			});
		}

		// remove the item from the queue
		room.queue.splice(matchIdx, 1);

		// respond
		res.json({
			success: true,
		});
		roommanager.updateRoom(roommanager.rooms[req.params.name]);
	});

	router.get("/data/previewAdd", (req, res) => {
		// FIXME: this endpoint has the potential to be abused.
		// TODO: rate limit

		console.log("Getting queue add preview for", req.query.input);
		try {
			InfoExtract.getAddPreview(req.query.input).then(result => {
				res.json(result);
			});
		}
		catch (error) {
			console.error("Unable to get add preview", error);
			res.status(500).json([{ error: "Unable to preview" }]);
		}
	});

	return router;
};
