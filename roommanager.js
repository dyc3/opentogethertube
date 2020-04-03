const WebSocket = require('ws');
const _ = require("lodash");
const moment = require("moment");
const { uniqueNamesGenerator } = require('unique-names-generator');
const NanoTimer = require("nanotimer");
const InfoExtract = require("./infoextract");
const storage = require("./storage");
const Video = require("./common/video.js");
const { getLogger } = require("./logger.js");

const log = getLogger("roommanager");

const SUPPORTED_SERVICES = [
	"youtube", "vimeo", "dailymotion",
];

// Custom websocket error codes
const WS_ERROR_INVALID_CONNECTION_URL = 4001;
const WS_ERROR_ROOM_NOT_FOUND = 4002;
const WS_ERROR_ROOM_UNLOADED = 4003;

/**
 * Represents a Room and all it's associated state, settings, connected clients.
 */
class Room {
	/**
	 * DO NOT CREATE NEW ROOMS WITH THIS CONSTRUCTOR. Create/get Rooms using the RoomManager.
	 */
	constructor(args=undefined) {
		this._dirtyProps = [];

		this.name = "";
		this.title = "";
		this.description = "";
		this.isTemporary = false;
		this.visibility = "public";
		this.queueMode = "manual"; // manual, vote
		this.currentSource = {};
		this.queue = [];
		this.isPlaying = false;
		this.playbackPosition = 0;
		this.clients = [];
		this.keepAlivePing = null;
		if (args) {
			Object.assign(this, args);
		}

		this.log = log.child({
			roomName: this.name,
		});
	}

	get name() {
		return this._name;
	}

	set name(value) {
		this._name = value;
		this._dirtyProps.push("name");
	}

	get title() {
		return this._title;
	}

	set title(value) {
		this._title = value;
		this._dirtyProps.push("title");
	}

	get description() {
		return this._description;
	}

	set description(value) {
		this._description = value;
		this._dirtyProps.push("description");
	}

	get isTemporary() {
		return this._isTemporary;
	}

	set isTemporary(value) {
		this._isTemporary = value;
		this._dirtyProps.push("isTemporary");
	}

	get visibility() {
		return this._visibility;
	}

	set visibility(value) {
		this._visibility = value;
		this._dirtyProps.push("visibility");
	}

	get queueMode() {
		return this._queueMode;
	}

	set queueMode(value) {
		this._queueMode = value;
		this._dirtyProps.push("queueMode");
	}

	get currentSource() {
		return this._currentSource;
	}

	set currentSource(value) {
		this._currentSource = value;
		this._dirtyProps.push("currentSource");
	}

	get isPlaying() {
		return this._isPlaying;
	}

	set isPlaying(value) {
		this._isPlaying = value;
		this._dirtyProps.push("isPlaying");
	}

	get playbackPosition() {
		return this._playbackPosition;
	}

	set playbackPosition(value) {
		this._playbackPosition = value;
		this._dirtyProps.push("playbackPosition");
	}

	/**
	 * Obtains metadata for a given video and adds it to the queue
	 * @param {Video|Object} video The video to add. Should contain either a `url` property, or `service` and `id` properties.
	 */
	addToQueue(video, session=null) {
		let queueItem = new Video();

		if (video.hasOwnProperty("url")) {
			queueItem.service = InfoExtract.getService(video.url);

			if (queueItem.service === "youtube") {
				queueItem.id = InfoExtract.getVideoIdYoutube(video.url);
			}
			else if (queueItem.service === "vimeo") {
				queueItem.id = InfoExtract.getVideoIdVimeo(video.url);
			}
			else if (queueItem.service === "dailymotion") {
				queueItem.id = InfoExtract.getVideoIdDailymotion(video.url);
			}
		}
		else {
			queueItem.service = video.service;
			queueItem.id = video.id;
		}

		if (SUPPORTED_SERVICES.includes(queueItem.service)) {
			// TODO: fallback to "unofficial" methods of retreiving if using the youtube API fails.
			return InfoExtract.getVideoInfo(queueItem.service, queueItem.id).then(result => {
				queueItem = result;
			}).catch(err => {
				this.log.error(`Failed to get video info: ${err}`);
				queueItem.title = queueItem.id;
			}).then(() => {
				this.queue.push(queueItem);
				this._dirtyProps.push("queue");
				this.update();
				this.sync();

				if (session) {
					this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.ADD_TO_QUEUE, session.username, { video: queueItem }));

					if (this.queueMode === "vote") {
						this.voteVideo(queueItem, session);
					}
				}
				else {
					this.log.warn("UNABLE TO SEND ROOM EVENT: Couldn't send room event addToQueue because no session information was provided.");
				}
				return true;
			});
		}
		else {
			throw `Service ${queueItem.service} not yet supported`;
		}
	}

	/**
	 * Vote for a video if the room is in voting mode.
	 * @param {Video|Object} video The video to vote for.
	 * @param {Object} session The user session that is voting for the video
	 */
	voteVideo(video, session) {
		if (this.queueMode !== "vote") {
			this.log.error("Room not in voting mode");
			return false;
		}

		// check if the voted video is in the queue
		let matchIdx = _.findIndex(this.queue, item => item.service === video.service && item.id === video.id);
		if (matchIdx < 0) {
			this.log.error("Can't vote for video not in queue");
			return false;
		}

		if (!this.queue[matchIdx].votes) {
			this.queue[matchIdx].votes = [];
		}

		// check to see if the vote already exists
		if (_.findIndex(this.queue[matchIdx].votes, { userSessionId: session.id }) >= 0) {
			this.log.error("Vote for video already exists");
			return false;
		}

		this.queue[matchIdx].votes.push({ userSessionId: session.id });
		this.queue[matchIdx]._lastVotesChanged = moment();
		this._dirtyProps.push("queue");
		return true;
	}

	/**
	 * Remove a user's vote for a video if the room is in voting mode.
	 * @param {Video|Object} video The video to remove the vote for.
	 * @param {Object} session The user session that is voting for the video
	 */
	removeVoteVideo(video, session) {
		if (this.queueMode !== "vote") {
			this.log.error("Room not in voting mode");
			return false;
		}

		let matchIdx = _.findIndex(this.queue, item => item.service === video.service && item.id === video.id);
		if (matchIdx < 0) {
			this.log.error("Can't remove vote for video not in queue");
			return false;
		}

		this.queue[matchIdx].votes = _.reject(this.queue[matchIdx].votes, { userSessionId: session.id });
		this.queue[matchIdx]._lastVotesChanged = moment();
		this._dirtyProps.push("queue");
		return true;
	}

	removeFromQueue(video, session=null) {
		let matchIdx = _.findIndex(this.queue, item => item.service === video.service && item.id === video.id);
		if (matchIdx < 0) {
			return false;
		}
		// remove the item from the queue
		let removed = this.queue.splice(matchIdx, 1)[0];
		this._dirtyProps.push("queue");
		if (session) {
			this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.REMOVE_FROM_QUEUE, session.username, { video: removed, queueIdx: matchIdx }));
		}
		else {
			this.log.warn("UNABLE TO SEND ROOM EVENT: Couldn't send room event removeFromQueue because no session information was provided.");
		}
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
				this.log.debug("Remove inactive client:", i, this.clients[i].session.username);
				this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.LEAVE_ROOM, this.clients[i].session.username, {}));
				this.clients.splice(i--, 1);
				this._dirtyProps.push("users");
				continue;
			}
		}

		// sort queue according to queue mode
		if (this.queueMode === "vote") {
			let _oldOrder = _.clone(this.queue);
			this.queue = _.orderBy(this.queue, [
				video => video.votes ? video.votes.length : 0,
				video => video._lastVotesChanged,
			], [
				"desc",
				"asc",
			]);
			if (this.queue.length > 0 && !this.queue.every((value, index) => _.isEqual(value, _oldOrder[index]))) {
				this._dirtyProps.push("queue");
			}
		}

		// HACK: sometimes, if we fuck up getting a video, currentSource may become undefined.
		// So if that happens, log it so we can catch it.
		if (this.currentSource === undefined) {
			this.log.error("currentSource is undefined! This is not good.");
		}

		if (_.isEmpty(this.currentSource) && this.queue.length > 0) {
			this.currentSource = this.queue.shift();
			this._dirtyProps.push("queue");
		}
		else if (!_.isEmpty(this.currentSource) && this.playbackPosition > this.currentSource.length) {
			this.currentSource = this.queue.length > 0 ? this.queue.shift() : {};
			this._dirtyProps.push("queue");
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
		this._dirtyProps = _.uniq(this._dirtyProps);

		let syncMsg = {
			action: "sync",
			name: this.name,
			title: this.title,
			description: this.description,
			isTemporary: this.isTemporary,
			queueMode: this.queueMode,
			currentSource: this.currentSource,
			queue: _.cloneDeep(this.queue),
			isPlaying: this.isPlaying,
			playbackPosition: this.playbackPosition,
			users: [],
		};

		for (const client of this.clients) {
			// make sure the socket is still open
			if (client.socket.readyState != 1) {
				continue;
			}

			if (!client.needsFullSync && this._dirtyProps.length == 0) {
				continue;
			}

			syncMsg.users = this.clients.map(c => {
				return {
					name: c.session.username,
					isYou: client.socket == c.socket,
					status: c.status,
				};
			});

			// include if the user has voted
			if (this.queueMode === "vote") {
				syncMsg.queue = this.queue.map(video => {
					let v = _.cloneDeep(video);
					v.votes = video.votes ? video.votes.length : 0;
					v.voted = _.find(video.votes, { userSessionId: client.session.id }) ? true : false;
					return v;
				});
			}

			let dirtySyncMsg = _.pick(syncMsg, _.concat(["action"], this._dirtyProps));
			if (client.needsFullSync) {
				this.log.debug("sending full sync message to client");
				dirtySyncMsg = syncMsg;
				client.needsFullSync = false;
			}

			try {
				client.socket.send(JSON.stringify(dirtySyncMsg));
			}
			catch (error) {
				// ignore errors
			}
		}
		this._dirtyProps = [];
	}

	/**
	 * Sends the room event to all clients.
	 * @param {RoomEvent} event
	 */
	sendRoomEvent(event) {
		this.log.log({ level: "info", roomEvent: event });
		let msg = {
			action: "event",
			event: event,
		};
		for (let c of this.clients) {
			try {
				c.socket.send(JSON.stringify(msg));
			}
			catch (error) {
				// ignore errors
			}
		}
	}

	/**
	 * Performs the opposite of the event to undo it.
	 * @param {RoomEvent|Object} event The event to be reverted.
	 */
	undoEvent(event) {
		if (event.eventType === ROOM_EVENT_TYPE.SEEK) {
			this.playbackPosition = event.parameters.previousPosition;
			this._dirtyProps.push("playbackPosition");
		}
		else if (event.eventType === ROOM_EVENT_TYPE.SKIP) {
			if (this.currentSource) {
				this.queue.unshift(this.currentSource); // put current video back onto the top of the queue
				this._dirtyProps.push("queue");
			}
			this.currentSource = event.parameters.video;
			this.playbackPosition = 0;
			this._dirtyProps.push("currentSource");
			this._dirtyProps.push("playbackPosition");
		}
		else if (event.eventType === ROOM_EVENT_TYPE.ADD_TO_QUEUE) {
			if (this.queue.length > 0) {
				this.removeFromQueue(event.parameters.video);
				this._dirtyProps.push("queue");
			}
			else {
				this.currentSource = {};
				this._dirtyProps.push("currentSource");
			}
		}
		else if (event.eventType === ROOM_EVENT_TYPE.REMOVE_FROM_QUEUE) {
			let newQueue = this.queue.splice(0, event.parameters.queueIdx);
			newQueue.push(event.parameters.video);
			newQueue.push(...this.queue);
			this.queue = newQueue;
			this._dirtyProps.push("queue");
		}
		else {
			this.log.error(`Can't undo room event with type: ${event.eventType}`);
		}
	}

	/**
	 * Sends an announcement to all clients in this room.
	 * @param {String} text The message to send
	 */
	sendAnnouncement(text) {
		let msg = {
			action: "announcement",
			text,
		};
		for (let c of this.clients) {
			try {
				c.socket.send(JSON.stringify(msg));
			}
			catch (error) {
				// ignore errors
			}
		}
	}

	/**
	 * Called when a new client connects to this room.
	 * @param {Object} ws Websocket for the client.
	 * @param {Object} req HTTP request used to initiate the connection.
	 */
	onConnectionReceived(ws, req) {
		if (!req.session.username) {
			let username = uniqueNamesGenerator();
			this.log.debug(`Generated name for new user (on connect): ${username}`);
			req.session.username = username;
			req.session.save();
		}
		let client = {
			session: req.session,
			socket: ws,
			status: "joined",
			needsFullSync: true,
		};
		this.clients.push(client);
		this._dirtyProps.push("users");
		ws.on('message', (message) => {
			this.onMessageReceived(client, JSON.parse(message));
		});
		this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.JOIN_ROOM, client.session.username, {}));
	}

	/**
	 * Called when this room receives a message from one of it's users.
	 * @param {Object} client The client that sent the message
	 * @param {Object} message The message that the client sent as a object. Should always have an `action` attribute.
	 */
	onMessageReceived(client, msg) {
		if (msg.action === "play") {
			this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.PLAY, client.session.username, {}));
			this.isPlaying = true;
			this.sync();
		}
		else if (msg.action === "pause") {
			this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.PAUSE, client.session.username, {}));
			this.isPlaying = false;
			this.sync();
		}
		else if (msg.action === "seek") {
			if (msg.position === this.playbackPosition) {
				return;
			}
			this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.SEEK, client.session.username, { position: msg.position, previousPosition: this.playbackPosition }));
			this.playbackPosition = msg.position;
			this.sync();
		}
		else if (msg.action === "skip") {
			this.sendRoomEvent(new RoomEvent(this.name, ROOM_EVENT_TYPE.SKIP, client.session.username, { video: this.currentSource }));
			this.playbackPosition = this.currentSource.length + 1;
			this.update();
			this.sync();
		}
		else if (msg.action === "set-name") {
			if (!msg.name) {
				this.log.warn("name not supplied");
				return;
			}
			if (msg.name === client.session.username) {
				// name unchanged, ignore
				return;
			}
			log.info(`${client.session.username} changed name to ${msg.name}`);
			client.session.username = msg.name;
			client.session.save();
			this.update();
			this.sync();
		}
		else if (msg.action === "chat") {
			let chat = {
				action: msg.action,
				from: client.session.username,
				text: msg.text,
			};
			for (let c of this.clients) {
				try {
					c.socket.send(JSON.stringify(chat));
				}
				catch (error) {
					// ignore errors
				}
			}
		}
		else if (msg.action === "queue-move") {
			if (this.queueMode === "vote") {
				return;
			}

			let video = this.queue.splice(msg.currentIdx, 1)[0];
			this.queue.splice(msg.targetIdx, 0, video);
			this._dirtyProps.push("queue");
			this.sync();
		}
		else if (msg.action === "undo") {
			if (!msg.event) {
				this.log.warn("Room event to be undone was not supplied");
				return;
			}
			this.undoEvent(msg.event);
			this.sync();
		}
		else if (msg.action === "status") {
			this.log.debug(`status: ${client.session.username} ${msg.status}`);
			client.status = msg.status;
			this._dirtyProps.push("users");
			this.sync();
		}
		else {
			log.warn(`[ws] UNKNOWN ACTION ${msg.action}`);
		}
	}
}

const ROOM_EVENT_TYPE = {
	PLAY: "play",
	PAUSE: "pause",
	SKIP: "skip",
	SEEK: "seek",
	ADD_TO_QUEUE: "addToQueue",
	REMOVE_FROM_QUEUE: "removeFromQueue",
	JOIN_ROOM: "joinRoom",
	LEAVE_ROOM: "leaveRoom",
};

/**
 * Represents an action that a user performed in a room, like playing, pausing, skipping, adding to the queue, etc.
 */
class RoomEvent {
	constructor(roomName, eventType, userName, parameters) {
		this.roomName = roomName;
		this.eventType = eventType;
		this.userName = userName;
		this.parameters = _.cloneDeep(parameters);
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

class RoomNameTakenException extends Error {
	constructor(roomName) {
		super(`The room "${roomName}" is taken.`);
		this.name = "RoomNameTakenException";
	}
}

module.exports = {
	rooms: [],

	/**
	 * Start the room manager.
	 * @param {Object} httpServer The http server to get websocket connections from.
	 * @param {Object} sessions The session parser that express uses.
	 */
	start(httpServer, sessions, redisClient) {
		const wss = new WebSocket.Server({ noServer: true });

		httpServer.on('upgrade', (req, socket, head) => {
			sessions(req, {}, () => {
				wss.handleUpgrade(req, socket, head, ws => {
					wss.emit('connection', ws, req);
				});
			});
		});

		wss.on('connection', (ws, req) => {
			log.debug("[ws] CONNECTION ESTABLISHED", ws.protocol, req.url, ws.readyState);

			if (!req.url.startsWith("/api/room/")) {
				log.error("Closing connection because the connection url was invalid");
				ws.close(WS_ERROR_INVALID_CONNECTION_URL, "Invalid connection url");
				return;
			}
			let roomName = req.url.replace("/api/room/", "");
			this.getOrLoadRoom(roomName).then(room => {
				room.onConnectionReceived(ws, req);
			}).catch(err => {
				if (err.name === "RoomNotFoundException") {
					log.error("Closing connection because the room doesn't exist");
					ws.close(WS_ERROR_ROOM_NOT_FOUND, "Room doesn't exist");
					return;
				}
				else {
					throw err;
				}
			});
		});

		this.redisClient = redisClient;
		redisClient.on("connect", () => {
			log.info("Connected to redis");
		});
		redisClient.on("ready", () => {
			log.info("Redis client is ready");
		});
		redisClient.on('error', err => {
			log.error('error event - ' + redisClient.host + ':' + redisClient.port + ' - ' + err);
		});
		this.getAllLoadedRooms().then(result => {
			this.rooms = result || [];
			log.info(`Loaded ${this.rooms.length} rooms from redis`);
		});

		const nanotimer = new NanoTimer();
		nanotimer.setInterval(() => {
			for (const room of this.rooms) {
				if (room.isPlaying) {
					room.playbackPosition += 1;
				}

				room.update();
				room.sync();
				this.unloadIfEmpty(room);
			}

			this.saveAllLoadedRooms();
		}, '', '1000m');
	},

	/**
	 *  Checks if an empty (no active clients) room has been loaded for longer than a specified time, and unloads it if this is true.
	 * @param {Room} room The room to unload.
	 * @param {Number} time The time in seconds the room must be inactive for it to be unloaded.
	 */
	unloadIfEmpty(room, time=240) {
		if (room.clients.length == 0 &&
			moment().diff(room.keepAlivePing, 'seconds') > time) {
			this.unloadRoom(room);
		}
	},

	/**
	 * Create a new room using the given name.
	 * @param {string} name The name for the new room
	 * @param {boolean} isTemporary Whether or not the new room is temporary. Temporary rooms do not get stored in the database.
	 * @param {string} visibility Indicates the room's visibility. Only public rooms are shown on the rooms list.
	 */
	async createRoom(options, isTemporary=false, visibility="public") {
		if (typeof options === "string") {
			let name = options;
			options = {
				name,
				isTemporary,
				visibility,
			};
		}
		else {
			options = _.defaults(options, {
				isTemporary: false,
				visibility: "public",
			});
			if (options.temporary !== undefined) {
				options.isTemporary = options.temporary;
				delete options.temporary;
			}
		}

		if (_.find(this.rooms, room => room.name === options.name)) {
			throw new RoomNameTakenException(options.name);
		}
		if (await storage.isRoomNameTaken(options.name)) {
			throw new RoomNameTakenException(options.name);
		}

		let newRoom = new Room(options);
		if (options.isTemporary) {
			// Used to delete temporary rooms after a certain amount of time with no users connected
			newRoom.keepAlivePing = new Date();
		}
		else {
			await storage.saveRoom(newRoom);
		}
		this.rooms.push(newRoom);
	},

	/**
	 * Get all the loaded rooms from redis.
	 * @returns {Promise.<Array.<Room>>}
	 */
	getAllLoadedRooms() {
		return new Promise((resolve, reject) => {
			this.redisClient.get("rooms", (err, value) => {
				if (err) {
					reject(err);
					return;
				}
				if (!value) {
					return null;
				}
				let rooms = JSON.parse(value);
				resolve(rooms.map(room => {
					delete room.clients;
					delete room._dirtyProps;
					room.keepAlivePing = moment();
					return new Room(room);
				}));
			});
		});
	},

	/**
	 * Save all the loaded rooms into redis.
	 */
	saveAllLoadedRooms() {
		let rooms = _.cloneDeep(this.rooms).map(room => {
			delete room.clients;
			delete room._dirtyProps;
			delete room.log;
			return room;
		});
		this.redisClient.set("rooms", JSON.stringify(rooms), err => {
			if (err) {
				log.error(err);
				throw err;
			}
		});
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
			room.visibility = result.visibility;
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
		// HACK: for some reason, this became undefined when running unit tests,
		// even though clients is defined to be an empty list in the constructor.
		// This is one of the greatest mysteries of our time.
		if (room.clients) {
			for (const client of room.clients) {
				client.socket.send(JSON.stringify({
					action: "room-unload",
				}));
				client.socket.close(WS_ERROR_ROOM_UNLOADED, "Room has been unloaded");
			}
		}

		const roomIdx = _.findIndex(this.rooms, r => r.name === (typeof room === "string" ? room : room.name));
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
				log.debug(`Found room ${room.name} in loaded rooms`);
				return room;
			}
			else {
				log.debug(`Looking for room ${name} in database`);
				return this.loadRoom(name);
			}
		});
	},

	/**
	 * Sends an announcement to all currently connected clients in all rooms.
	 * @param {String} text The message to send
	 */
	sendAnnouncement(text) {
		for (let room of this.rooms) {
			room.sendAnnouncement(text);
		}
	},
};
