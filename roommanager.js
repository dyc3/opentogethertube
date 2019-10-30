const WebSocket = require('ws');
const { uniqueNamesGenerator } = require('unique-names-generator');
const _ = require("lodash");
const moment = require("moment");
const NanoTimer = require("nanotimer");
const InfoExtract = require("./infoextract");
const storage = require("./storage");

/**
 * Represents a Room and all it's associated state, settings, connected clients.
 */
class Room {
	/**
	 * DO NOT CREATE NEW ROOMS WITH THIS CONSTRUCTOR. Create/get Rooms using the RoomManager.
	 */
	constructor() {
		this.name = "";
		this.title = "";
		this.description = "";
		this.isTemporary = false;
		this.currentSource = {};
		this.queue = [];
		this.isPlaying = false;
		this.playbackPosition = 0;
		this.clients = [];
		this.keepAlivePing = null;
	}

	/**
	 * Obtains metadata for a given video and adds it to the queue
	 * @param {Object} video The video to add. Should contain either a `url` property, or `service` and `id` properties.
	 */
	addToQueue(video) {
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
				console.error("Failed to get video info:", err);
				queueItem.title = queueItem.id;
			}).then(() => {
				this.queue.push(queueItem);
				this.update();
				this.sync();
				return true;
			});
		}
		else {
			throw `Service ${queueItem.service} not yet supported`;
		}
	}

	removeFromQueue(video) {
		let matchIdx = _.findIndex(this.queue, item => item.service === video.service && item.id === video.id);
		if (matchIdx < 0) {
			return false;
		}
		// remove the item from the queue
		this.queue.splice(matchIdx, 1);
		this.sync();
		return true;
	}

	/**
	 * Updates the room state. Any logic that makes the room do
	 * something automatically without a user's input goes here
	 * (automatically playing the next video in the queue, etc.)
	 */
	update() {
		// remove inactive clients
		for (let i = 0; i < this.clients.length; i++) {
			let ws = this.clients[i].socket;
			if (ws.readyState != 1) {
				console.log("Remove inactive client:", i, this.clients[i].name);
				this.clients.splice(i--, 1);
				continue;
			}
		}

		if (_.isEmpty(this.currentSource) && this.queue.length > 0) {
			this.currentSource = this.queue.shift();
		}
		else if (!_.isEmpty(this.currentSource) && this.playbackPosition > this.currentSource.length) {
			this.currentSource = this.queue.length > 0 ? this.queue.shift() : {};
			this.playbackPosition = 0;
		}
		if (_.isEmpty(this.currentSource) && this.queue.length == 0 && this.isPlaying) {
			this.isPlaying = false;
			this.playbackPosition = 0;
		}

		// remove empty rooms
		if (this.clients.length > 0) {
			this.keepAlivePing = moment();
		}
	}

	/**
	 * Synchronize all clients in this room by sending a sync message.
	 */
	sync() {
		let syncMsg = {
			action: "sync",
			name: this.name,
			title: this.title,
			description: this.description,
			isTemporary: this.isTemporary,
			currentSource: this.currentSource,
			queue: this.queue,
			isPlaying: this.isPlaying,
			playbackPosition: this.playbackPosition,
			users: [],
		};

		for (const client of this.clients) {
			// make sure the socket is still open
			if (client.socket.readyState != 1) {
				continue;
			}

			syncMsg.users = this.clients.map(c => {
				return {
					name: c.name,
					isYou: client.socket == c.socket,
				};
			});

			client.socket.send(JSON.stringify(syncMsg));
		}
	}

	/**
	 * Called when a new client connects to this room.
	 * @param {Object} ws Websocket for the client.
	 */
	onConnectionReceived(ws) {
		let client = {
			name: "client",
			socket: ws,
		};
		this.clients.push(client);
		ws.on('message', (message) => {
			this.onMessageReceived(client, JSON.parse(message));
		});
	}

	/**
	 * Called when this room receives a message from one of it's users.
	 * @param {Object} client The client that sent the message
	 * @param {Object} message The message that the client sent as a object. Should always have an `action` attribute.
	 */
	onMessageReceived(client, msg) {
		if (msg.action === "play") {
			this.isPlaying = true;
			this.sync();
		}
		else if (msg.action === "pause") {
			this.isPlaying = false;
			this.sync();
		}
		else if (msg.action === "seek") {
			this.playbackPosition = msg.position;
			this.sync();
		}
		else if (msg.action === "skip") {
			this.playbackPosition = this.currentSource.length + 1;
			this.update();
			this.sync();
		}
		else if (msg.action === "set-name") {
			if (!msg.name) {
				console.warn("name not supplied");
				return;
			}
			client.name = msg.name;
			this.update();
			this.sync();
		}
		else if (msg.action === "generate-name") {
			let generatedName = uniqueNamesGenerator();
			client.socket.send(JSON.stringify({
				action: "generatedName",
				name: generatedName,
			}));
			client.name = generatedName;
			this.update();
			this.sync();
		}
		else if (msg.action === "chat") {
			let chat = {
				action: msg.action,
				from: client.name,
				text: msg.text,
			};
			for (let c of this.clients) {
				c.socket.send(JSON.stringify(chat));
			}
		}
		else {
			console.warn("[ws] UNKNOWN ACTION", msg.action);
		}
	}
}

class RoomNotFoundException extends Error {
	constructor(roomName) {
		super(`The room "${roomName}" could not be found.`);
		this.name = "RoomNotFoundException";
	}
}

class RoomAlreadyLoadedException extends Error {
	constructor(roomName) {
		super(`The room "${roomName}" is already loaded.`);
		this.name = "RoomAlreadyLoadedException";
	}
}

module.exports = {
	rooms: [],

	/**
	 * Start the room manager.
	 * @param {Object} httpServer The http server to get websocket connections from.
	 */
	start(httpServer) {
		const wss = new WebSocket.Server({ server: httpServer });

		wss.on('connection', (ws, req) => {
			console.log("[ws] CONNECTION ESTABLISHED", ws.protocol, req.url, ws.readyState);

			if (!req.url.startsWith("/api/room/")) {
				console.error("[ws] Invalid connection url");
				ws.close(4001, "Invalid connection url");
				return;
			}
			let roomName = req.url.replace("/api/room/", "");
			this.getOrLoadRoom(roomName).then(room => {
				room.onConnectionReceived(ws);
			}).catch(err => {
				if (err.name === "RoomNotFoundException") {
					console.error("[ws] Room doesn't exist");
					ws.close(4002, "Room doesn't exist");
					return;
				}
				else {
					throw err;
				}
			});
		});

		const nanotimer = new NanoTimer();
		nanotimer.setInterval(() => {
			for (const room of this.rooms) {
				if (room.isPlaying) {
					room.playbackPosition += 1;
				}

				room.update();
				room.sync();

				if (room.clients.length == 0 &&
					moment().diff(room.keepAlivePing, 'seconds') > 10) {
					this.unloadRoom(room);
				}
			}
		}, '', '1000m');
	},

	/**
	 * Create a new room using the given name.
	 * @param {string} name The name for the new room
	 * @param {boolean} isTemporary Whether or not the new room is temporary. Temporary rooms do not get stored in the database.
	 */
	createRoom(name, isTemporary=false) {
		let newRoom = new Room();
		newRoom.name = name;
		newRoom.isTemporary = isTemporary;
		if (isTemporary) {
			// Used to delete temporary rooms after a certain amount of time with no users connected
			newRoom.keepAlivePing = new Date();
		}
		else {
			storage.saveRoom(newRoom);
		}
		this.rooms.push(newRoom);
	},

	/**
	 * Loads the Room with the given name from the database. If the
	 * room is already loaded, the promise resolves to the loaded Room.
	 * @param {string} name The name of the room to load.
	 * @returns {Promise} Promise that resolves to a Room.
	 * @throws {RoomNotFoundException}
	 * @throws {RoomAlreadyLoadedException}
	 */
	loadRoom(name) {
		if (_.findIndex(this.rooms, r => r.name === name) >= 0) {
			throw new RoomAlreadyLoadedException(name);
		}

		return storage.getRoomByName(name).then(result => {
			if (!result) {
				throw new RoomNotFoundException(name);
			}

			let room = new Room();
			room.name = result.name;
			room.title = result.title;
			room.description = result.description;
			room.isTemporary = false;
			this.rooms.push(room);
			return room;
		});
	},

	/**
	 * Unloads the room with the given name from memory.
	 * @param {Room} room The room to unload
	 */
	unloadRoom(room) {
		for (const client of room.clients) {
			client.socket.send(JSON.stringify({
				action: "room-unload",
			}));
			client.socket.close(4003, "Room has been unloaded");
		}

		const roomIdx = _.findIndex(this.rooms, r => r.name === room.name);
		this.rooms.splice(roomIdx, 1);
	},

	/**
	 * Gets the Room by name if it's loaded into memory, otherwise returns false.
	 * @param {string} name The name of the room
	 * @returns {(Room|boolean)}
	 */
	getLoadedRoom(name) {
		return new Promise(resolve => {
			for (const room of this.rooms) {
				if (room.name === name) {
					resolve(room);
					return;
				}
			}
			resolve(false);
		});
	},

	/**
	 * Gets the loaded Room, if its loaded, otherwise grab it from the database.
	 * If the Room can't be found it will throw a RoomNotFoundException.
	 * @param {string} name The name of the room
	 * @throws {RoomNotFoundException}
	 */
	getOrLoadRoom(name) {
		return this.getLoadedRoom(name).then(room => {
			if (room) {
				console.log(`Found room ${room.name} in loaded rooms`);
				return room;
			}
			else {
				console.log(`Looking for room ${name} in database`);
				return this.loadRoom(name);
			}
		});
	},
};
