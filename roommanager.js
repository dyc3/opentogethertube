const WebSocket = require('ws');
const InfoExtract = require("./infoextract");
const { uniqueNamesGenerator } = require('unique-names-generator');
const _ = require("lodash");
const moment = require("moment");

module.exports = function (server, storage) {
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
			users: [],
		};

		for (let i = 0; i < room.clients.length; i++) {
			let ws = room.clients[i].socket;

			// make sure the socket is still open
			if (ws.readyState != 1) {
				continue;
			}

			syncMsg.users = [];
			for (let u = 0; u < room.clients.length; u++) {
				syncMsg.users.push({
					name: room.clients[u].name,
					isYou: ws == room.clients[u].socket,
				});
			}

			ws.send(JSON.stringify(syncMsg));
		}
	}
	
	function modifyRoom(room, props) {
		for (let k in props) {
			room[k] = props[k];
		}
		rooms[room.name] = room;
		if (!room.isTemporary) {
			storage.saveRoom(room);
		}
	}

	function updateRoom(room) {
		if (_.isEmpty(room.currentSource) && room.queue.length > 0) {
			room.currentSource = room.queue.shift();
		}
		else if (!_.isEmpty(room.currentSource) && room.playbackPosition > room.currentSource.length) {
			room.currentSource = room.queue.length > 0 ? room.queue.shift() : {};
			room.playbackPosition = 0;
		}
		if (_.isEmpty(room.currentSource) && room.queue.length == 0 && room.isPlaying) {
			room.isPlaying = false;
			room.playbackPosition = 0;
		}
		syncRoom(room);
	}

	function createRoom(roomName, isTemporary=false) {
		// temporary rooms are not stored in the database
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
		};
		if (isTemporary) {
			// Used to delete temporary rooms after a certain amount of time with no users connected
			newRoom.keepAlivePing = new Date();
		}
		else {
			storage.saveRoom(newRoom);
		}
		rooms[roomName] = newRoom;
	}

	function deleteRoom(roomName) {
		for (let i = 0; i < rooms[roomName].clients.length; i++) {
			rooms[roomName].clients[i].socket.send(JSON.stringify({
				action: "room-delete",
			}));
			rooms[roomName].clients[i].socket.close(4003, "Room has been deleted");
		}
		delete rooms[roomName];
	}

	function getRoom(roomName) {
		if (rooms.hasOwnProperty(roomName)) {
			console.log("Room already loaded from db");
			return new Promise(resolve =>resolve(rooms[roomName]));
		}

		// load the room from storage if it exists
		console.log("Grabbing room", roomName, "from db");
		return storage.getRoomByName(roomName).then(result => {
			if (!result) {
				return false;
			}

			let room = {
				name: result.name,
				title: result.title,
				description: result.description,
				isTemporary: false,
				currentSource: {},
				queue: [],
				clients: [],
				isPlaying: false,
				playbackPosition: 0,
			};
			rooms[roomName] = room;
			return room;
		});
	}

	function addToQueue(roomName, video) {
		let queueItem = {
			service: "",
			id: "",
			title: "",
			description: "",
			thumbnail: "",
			length: 0,
		};

		if (video.hasOwnProperty("url")) {
			queueItem.service = InfoExtract.getService(video.url);

			if (queueItem.service === "youtube") {
				queueItem.id = InfoExtract.getVideoIdYoutube(video.url);
			}
		}
		else {
			queueItem.service = video.service;
			queueItem.id = video.id;
		}

		if (queueItem.service === "youtube") {
			// TODO: fallback to "unofficial" methods of retreiving if using the youtube API fails.
			return InfoExtract.getVideoInfo(queueItem.service, queueItem.id).then(result => {
				queueItem = result;
			}).catch(err => {
				console.error("Failed to get video info");
				console.error(err);
				queueItem.title = queueItem.id;
			}).then(() => {
				rooms[roomName].queue.push(queueItem);
				updateRoom(rooms[roomName]);
				return true;
			});
		}
		else {
			throw `Service ${queueItem.service} not yet supported`;
		}
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
		},
	};

	wss.on('connection', (ws, req) => {
		console.log("[ws] CONNECTION ESTABLISHED", ws.protocol, req.url, ws.readyState);

		if (!req.url.startsWith("/api/room/")) {
			console.error("[ws] Invalid connection url");
			ws.close(4001, "Invalid connection url");
			return;
		}
		let roomName = req.url.replace("/api/room/", "");
		getRoom(roomName).then(result => {
			if (!result) {
				console.error("[ws] Room doesn't exist");
				ws.close(4002, "Room doesn't exist");
				return;
			}
		}).then(() => {
			rooms[roomName].clients.push({
				name: "client",
				socket: ws,
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
					rooms[roomName].playbackPosition = rooms[roomName].currentSource.length + 1;
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
						name: generatedName,
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
	});

	setInterval(() => {
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
					room.keepAlivePing = moment();
				}
				else {
					if (moment().diff(room.keepAlivePing, 'seconds') > 10) {
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
		modifyRoom,
		updateRoom,
		createRoom,
		deleteRoom,
		addToQueue,
		getRoom,
	};
};
