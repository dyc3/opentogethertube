const WebSocket = require('ws');
const InfoExtract = require("./infoextract");
const { uniqueNamesGenerator } = require('unique-names-generator');
const url = require("url");
const querystring = require('querystring');
const _ = require("lodash");

module.exports = function (server) {
	function syncRoom(room) {
		let syncMsg = {
			action: "sync",
			name: room.name,
			title: room.title,
			description: room.description,
			isTemporary: room.isTemporary,
			currentSource: room.currentSource,
			queue: room.queue,
			isPlaying: room.isPlaying,
			playbackPosition: room.playbackPosition,
			playbackDuration: room.playbackDuration,
			users: []
		};


		for (let i = 0; i < room.clients.length; i++) {
			syncMsg.users = [];
			for (let u = 0; u < room.clients.length; u++) {
				syncMsg.users.push({
					name: room.clients[u].name,
					isYou: room.clients[i].socket == room.clients[u].socket
				});
			}

			let ws = room.clients[i].socket;
			ws.send(JSON.stringify(syncMsg));
		}
	}

	function updateRoom(room) {
		if (!_.isEmpty(room.currentSource) && room.currentSource.hasOwnProperty("length")) {
			// FIXME: the client expectes playbackDuration to exist and be >0.
			// A better way to do this would be for the client to infer playbackDuration
			// from currentsource.length
			room.playbackDuration = room.currentSource.length;
		}

		if (_.isEmpty(room.currentSource) && room.queue.length > 0) {
			room.currentSource = room.queue.shift();
		}
		else if (!_.isEmpty(room.currentSource) && room.playbackPosition > room.playbackDuration) {
			room.currentSource = room.queue.length > 0 ? room.queue.shift() : {};
			room.playbackPosition = 0;
		}
		if (_.isEmpty(room.currentSource) && room.queue.length == 0 && room.isPlaying) {
			room.isPlaying = false;
			room.playbackPosition = 0;
			room.playbackDuration = 0;
		}
		syncRoom(room);
	}

	function createRoom(roomName, isTemporary=false) {
		let newRoom = {
			name: roomName,
			title: "",
			description: "",
			isTemporary: isTemporary,
			currentSource: {},
			queue: [],
			clients: [],
			isPlaying: false,
			playbackPosition: 0,
			playbackDuration: 0
		};
		if (isTemporary) {
			// Used to delete temporary rooms after a certain amount of time with no users connected
			newRoom.keepAlivePing = new Date();
		}
		rooms[roomName] = newRoom;
	}

	function deleteRoom(roomName) {
		for (let i = 0; i < rooms[roomName].clients.length; i++) {
			rooms[roomName].clients[i].socket.send(JSON.stringify({
				action: "room-delete"
			}));
			rooms[roomName].clients[i].socket.close(4003, "Room has been deleted");
		}
		delete rooms[roomName];
	}

	function addToQueue(roomName, link) {
		let queueItem = {
			service: "",
			id: "",
			length: 0
		};

		return InfoExtract.getVideoLengthYoutube(link).then(seconds => {
			queueItem.length = seconds;
		}).catch(err => {
			console.error("Failed to get video length");
			console.error(err);
		}).then(() => {
			let srcUrl = url.parse(link);

			if (srcUrl.host.endsWith("youtube.com") || srcUrl.host.endsWith("youtu.be")) {
				queueItem.service = "youtube";
				queueItem.id = InfoExtract.getVideoIdYoutube(link);
			}
			else {
				console.log("unknown url, host", srcUrl.host);
				return false;
			}
			rooms[roomName].queue.push(queueItem);
			updateRoom(rooms[roomName]);
			return true;
		});
	}

	const wss = new WebSocket.Server({ server });

	let rooms = {
		test: {
			name: "test",
			title: "Test Room",
			description: "This is a test room.",
			isTemporary: false,
			currentSource: "",
			queue: [],
			clients: [],
			isPlaying: false,
			playbackPosition: 0,
			playbackDuration: 0
		}
	};

	wss.on('connection', (ws, req) => {
		console.log("[ws] CONNECTION ESTABLISHED", ws.protocol, req.url, ws.readyState);

		if (!req.url.startsWith("/api/room/")) {
			console.error("[ws] Invalid connection url");
			ws.close(4001, "Invalid connection url");
			return;
		}
		let roomName = req.url.replace("/api/room/", "");
		if (!rooms.hasOwnProperty(roomName)) {
			console.error("[ws] Room doesn't exist");
			ws.close(4002, "Room doesn't exist");
			return;
		}

		rooms[roomName].clients.push({
			name: "client",
			socket: ws
		});
		console.log("[ws] client joined", roomName);

		ws.on('message', (message) => {
			console.log('[ws] received:', typeof(message), message);
			let msg = JSON.parse(message);
			if (msg.action == "play") {
				rooms[roomName].isPlaying = true;
				syncRoom(rooms[roomName]);
			}
			else if (msg.action == "pause") {
				rooms[roomName].isPlaying = false;
				syncRoom(rooms[roomName]);
			}
			else if (msg.action == "seek") {
				rooms[roomName].playbackPosition = msg.position;
				syncRoom(rooms[roomName]);
			}
			else if (msg.action == "skip") {
				rooms[roomName].playbackPosition = rooms[roomName].playbackDuration + 1;
				updateRoom(rooms[roomName]);
			}
			else if (msg.action == "set-name") {
				if (!msg.name) {
					console.warn("name not supplied");
					return;
				}
				for (let i = 0; i < rooms[roomName].clients.length; i++) {
					if (rooms[roomName].clients[i].socket == ws) {
						rooms[roomName].clients[i].name = msg.name;
						break;
					}
				}
				updateRoom(rooms[roomName]);
			}
			else if (msg.action == "generate-name") {
				let generatedName = uniqueNamesGenerator();
				ws.send(JSON.stringify({
					action: "generatedName",
					name: generatedName
				}));

				for (let i = 0; i < rooms[roomName].clients.length; i++) {
					if (rooms[roomName].clients[i].socket == ws) {
						rooms[roomName].clients[i].name = generatedName;
						break;
					}
				}
				updateRoom(rooms[roomName]);
			}
			else {
				console.warn("[ws] UNKNOWN ACTION", msg.action);
			}
		});

		// sync room immediately
		syncRoom(rooms[roomName]);
	});

	let roomTicker = setInterval(function() {
		let roomsToDelete = [];
		for (let roomName in rooms) {
			let room = rooms[roomName];

			// remove inactive clients
			for (let i = 0; i < room.clients.length; i++) {
				let ws = room.clients[i].socket;
				if (ws.readyState != 1) {
					console.log("Remove inactive client:", i, room.clients[i].name);
					room.clients.splice(i, 1);
					i--;
					continue;
				}
			}

			if (room.isPlaying) {
				room.playbackPosition += 1;
				updateRoom(room);
			}

			// remove empty temporary rooms
			if (room.isTemporary) {
				if (room.clients.length > 0) {
					room.keepAlivePing = new Date();
				}
				else {
					let diffSeconds = (new Date() - room.keepAlivePing) / 1000;
					if (diffSeconds > 10) {
						console.log("Removing inactive temporary room", roomName);
						roomsToDelete.push(roomName);
					}
				}
			}
		}

		for (let i = 0; i < roomsToDelete.length; i++) {
			deleteRoom(roomsToDelete[i]);
		}
	}, 1000);

	return {
		rooms,
		syncRoom,
		updateRoom,
		createRoom,
		deleteRoom,
		addToQueue
	};
};