const WebSocket = require('ws');
const InfoExtract = require("./infoextract");

module.exports = function (server) {
	function syncRoom(room) {
		let syncMsg = {
			action: "sync",
			name: "test",
			currentSource: room.currentSource,
			queue: room.queue,
			isPlaying: room.isPlaying,
			playbackPosition: room.playbackPosition,
			playbackDuration: room.playbackDuration
		};
		for (let i = 0; i < room.clients.length; i++) {
			let ws = room.clients[i].socket;
			if (ws.readyState != 1) {
				continue;
			}
			ws.send(JSON.stringify(syncMsg));
		}
	}

	function updateRoom(room) {
		if (room.currentSource == "" && room.queue.length > 0) {
			room.currentSource = room.queue.shift();
			InfoExtract.getVideoLengthYoutube(room.currentSource).then(seconds => {
				room.playbackDuration = seconds;
			});
		}
		else if (room.playbackPosition > room.playbackDuration) {
			room.currentSource = room.queue.length > 0 ? room.queue.shift() : "";
			room.playbackPosition = 0;
			InfoExtract.getVideoLengthYoutube(room.currentSource).then(seconds => {
				room.playbackDuration = seconds;
			});
		}
		if (room.currentSource == "" && room.queue.length == 0 && room.isPlaying) {
			room.isPlaying = false;
		}
		syncRoom(room);
	}

	const wss = new WebSocket.Server({ server });

	let rooms = {
		test: {
			currentSource: "",
			queue: [],
			clients: [],
			isPlaying: false,
			playbackPosition: 0,
			playbackDuration: 0
		}
	};

	wss.on('connection', (ws) => {
		console.log("[ws] CONNECTION ESTABLISHED", ws.protocol, ws.url, ws.readyState);

		rooms["test"].clients.push({
			name: "client",
			socket: ws
		});

		//connection is up, let's add a simple simple event
		ws.on('message', (message) => {

			//log the received message and send it back to the client
			console.log('[ws] received:', typeof(message), message);
			let msg = JSON.parse(message);
			if (msg.action == "play") {
				rooms["test"].isPlaying = true;
				syncRoom(rooms["test"]);
			}
			else if (msg.action == "pause") {
				rooms["test"].isPlaying = false;
				syncRoom(rooms["test"]);
			}
			// ws.send(`Hello, you sent -> ${message}`);
		});

		// sync room immediately
		syncRoom(rooms["test"]);
	});

	let roomTicker = setInterval(function() {
		for (let roomName in rooms) {
			let room = rooms[roomName];
			console.log(room);
			if (room.isPlaying) {
				room.playbackPosition += 1;
				updateRoom(room);
			}
		}
	}, 1000);

	return {
		rooms: rooms,
		syncRoom: syncRoom,
		updateRoom: updateRoom
	};
};