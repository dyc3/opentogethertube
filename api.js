const express = require('express');
const _ = require("lodash");

module.exports = function(_roommanager) {
	const roommanager = _roommanager;
	const router = express.Router();

	router.get("/room/list", (req, res) => {
		let roomNames = _.keys(roommanager.rooms);
		let rooms = [];
		for (let i = 0; i < roomNames.length; i++) {
			let room = roommanager.rooms[roomNames[i]];
			rooms.push({
				name: roomNames[i],
				currentSource: room.currentSource,
				users: room.clients.length
			});
		}
		res.json(rooms);
	});

	router.get("/room/:name", (req, res) => {
		if (req.params.name === "test") {
			res.json(roommanager.rooms[req.params.name]);
		}
		else {
			res.status(404);
			res.json({
				error: "Room does not exist"
			});
		}
	});

	router.post("/room/create", (req, res) => {
		if (!req.body.name) {
			console.log(req.body);
			res.status(400).json({
				success: false,
				error: "Missing argument (name)"
			});
			return;
		}
		if (req.body.name == "list") {
			res.status(400).json({
				success: false,
				error: "Room name not allowed (reserved)"
			});
			return;
		}
		if (roommanager.rooms[req.body.name] != undefined) {
			// already exists
			res.status(400).json({
				success: false,
				error: "Room with that name already exists"
			});
			return;
		}
		roommanager.createRoom(req.body.name);
		res.json({
			success: true
		});
	});

	router.delete("/room/:name", (req, res) => {
		if (roommanager.rooms[req.params.name] == undefined) {
			res.status(400).json({
				success: false,
				error: "Room does not exist"
			});
			return;
		}
		roommanager.deleteRoom(req.params.name);
		res.status(200).json({
			success: true
		})
	});

	router.post("/room/:name/queue", (req, res) => {
		if (!roommanager.rooms.hasOwnProperty(req.params.name)) {
			res.status(404);
			res.json({
				error: "Room does not exist"
			});
			return;
		}
		roommanager.rooms[req.params.name].queue.push(req.body.url);
		res.json({
			success: true
		});
		roommanager.updateRoom(roommanager.rooms[req.params.name]);
	});

	return router;
};