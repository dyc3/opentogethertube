const express = require('express');
const uuid = require("uuid/v4");
const InfoExtract = require("./infoextract");

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
			res.json(room);
		}).catch(err => {
			if (err.name === "RoomNotFoundException") {
				res.status(404).json({
					success: false,
					error: "Room not found",
				});
			}
			else {
				console.error("Unhandled exception when getting room:", err);
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
		if (!req.body.temporary) {
			req.body.temporary = false;
		}
		if (!req.body.visibility) {
			req.body.visibility = "public";
		}
		roommanager.createRoom(req.body.name, req.body.temporary, req.body.visibility);
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
				console.error("Unhandled exception when getting room:", err);
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
				room.addToQueue({ url: req.body.url }).then(success => {
					res.json({
						success,
					});
				});
			}
			else if (req.body.service && req.body.id) {
				room.addToQueue({ service: req.body.service, id: req.body.id }).then(success => {
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
				console.error("Unhandled exception when getting room:", err);
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
				const success = room.removeFromQueue({ service: req.body.service, id: req.body.id });
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
				console.error("Unhandled exception when getting room:", err);
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

		console.log("Getting queue add preview for", req.query.input);
		try {
			InfoExtract.getAddPreview(req.query.input.trim()).then(result => {
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
