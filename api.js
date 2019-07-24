const express = require('express');
const router = express.Router();

let roommanager;

router.get("/room/:name", (req, res) => {
	if (req.params.name == "test") {
		res.json({
			currentVideo: roommanager[req.params.name].queue.length > 0 ? roommanager[req.params.name].queue[0] : ""
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
	if (req.params.name == "test") {
		roommanager[req.params.name].queue.push(req.body.url);
		res.json({
			success: true
		});
	}
	else {
		res.status(404);
		res.json({
			error: "Room does not exist"
		});
	}
});

module.exports = function(_roommanager) {
	roommanager = _roommanager;

	return router;
};