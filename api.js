const express = require('express');

module.exports = function(_roommanager) {
	const roommanager = _roommanager;
	const router = express.Router();

	router.get("/room/:name", (req, res) => {
		if (req.params.name === "test") {
			res.json({
				currentVideo: roommanager.rooms[req.params.name].queue.length > 0 ? roommanager.rooms[req.params.name].queue[0] : ""
			});
		}
		else {
			res.status(404);
			res.json({
				error: "Room does not exist"
			});
		}
	});

	router.post("/room/:name/queue", (req, res) => {
		if (req.params.name === "test") {
			roommanager.rooms[req.params.name].queue.push(req.body.url);
			res.json({
				success: true
			});
			roommanager.updateRoom(roommanager.rooms[req.params.name]);
		}
		else {
			res.status(404);
			res.json({
				error: "Room does not exist"
			});
		}
	});

	return router;
};