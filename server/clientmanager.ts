import { Session } from "express-session";
import WebSocket from "ws";
import { uniqueNamesGenerator } from "unique-names-generator";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { json, Request } from 'express';
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { ClientMessage, ClientMessageSeek, RoomRequestType, ServerMessage, ServerMessageSync } from "./messages";
import { RoomState } from "./room.js";
import { RoomNotFoundException } from "./exceptions";
// WARN: do NOT import roommanager
import roommanager from "./roommanager" // this is temporary because these modules are supposed to be completely isolated. In the future, it should send room requests via the HTTP API to other nodes.

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const get = promisify(redisClient.get).bind(redisClient);
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(redisSubscriber);
let connections: Client[] = [];
let roomStates: Map<string, RoomState> = new Map();
let roomJoins: Map<string, Client[]> = new Map();

enum OttWebsocketError {
	UNKNOWN = 4000,
	INVALID_CONNECTION_URL = 4001,
	ROOM_NOT_FOUND = 4002,
	ROOM_UNLOADED = 4003,
}

export class Client {
	id: string
	Socket: WebSocket
	Session: Session
	User: any
	UnregisteredUsername: string | null
	room: string | null

	constructor (session: Session, socket: WebSocket) {
		this.id = _.uniqueId(); // maybe use uuidv4 from uuid package instead?
		this.Session = session;
		this.Socket = socket;
		this.UnregisteredUsername = uniqueNamesGenerator()
		this.room = null;

		this.Socket.on("close", async (code, reason) => {
			log.debug(`socket closed: ${code}, ${reason}`)
			let idx = _.findIndex(connections, { id: this.id });
			connections.splice(idx, 1)

			if (this.room) {
				let room = await roommanager.GetRoom(this.room);
				await room.processRequest({
					type: RoomRequestType.LeaveRequest,
					id: this.id
				})
			}
		})
	}

	public get Username() : string {
		if (this.User) {
			return this.User.username;
		}
		else {
			return this.UnregisteredUsername!;
		}
	}

	public async OnMessage(text: string) {
		log.debug(text);
		let msg: ClientMessage = JSON.parse(text);
		let room = await roommanager.GetRoom(this.room!); // FIXME: only get room if it is loaded already.
		if (!room) {
			log.error(`room not found: ${this.room}`)
		}
		if (msg.action === "play") {
			room?.processRequest({
				type: RoomRequestType.PlaybackRequest,
				permission: "playback.play-pause",
				state: true,
			})
		}
		else if (msg.action === "pause") {
			room?.processRequest({
				type: RoomRequestType.PlaybackRequest,
				permission: "playback.play-pause",
				state: false,
			})
		}
		else if (msg.action === "skip") {
			room?.processRequest({
				type: RoomRequestType.SkipRequest,
				permission: "playback.skip",
			})
		}
		else if (msg.action === "seek") {
			room?.processRequest({
				type: RoomRequestType.SeekRequest,
				permission: "playback.seek",
				value: msg.position,
			})
		}
		else if (msg.action === "queue-move") {
			room?.processRequest({
				type: RoomRequestType.OrderRequest,
				permission: "manage-queue.order",
				fromIdx: msg.currentIdx,
				toIdx: msg.targetIdx,
			})
		}
		// else {
		// 	log.warn(`Unknown message: ${msg.action}`);
		// 	break;
		// }
	}

	public OnPing(data: Buffer) {
		log.debug(`sending pong`);
		this.Socket.pong();
	}

	public async JoinRoom(roomName: string) {
		log.info(`${this.Username} joining ${roomName}`);
		this.room = roomName;

		let room = await roommanager.GetRoom(roomName);
		if (!room) {
			throw new RoomNotFoundException(roomName);
		}
		// full sync
		let state = roomStates.get(roomName);
		if (state === undefined) {
			log.warn("room state not present, grabbing")
			let stateText = await get(`room:${roomName}`);
			state = JSON.parse(stateText!)!;
			roomStates.set(roomName, state!);
		}
		let syncMsg: ServerMessageSync = Object.assign({action: "sync"}, state) as ServerMessageSync;
		this.Socket.send(JSON.stringify(syncMsg));

		// actually join the room
		await room.processRequest({
			type: RoomRequestType.JoinRequest,
			id: this.id,
			username: this.Username,
		})
		subscribe(`room:${roomName}`);
		let clients = roomJoins.get(roomName);
		if (clients === undefined) {
			log.warn("room joins not present, creating")
			clients = [];
		}
		clients.push(this);
		roomJoins.set(roomName, clients);
	}
}

export function Setup() {
	log.debug("setting up client manager...");
	const server = wss as WebSocket.Server;
	server.on("connection", async (ws, req: Request & { session: Session }) => {
		if (!req.url!.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await OnConnect(req.session, ws, req);
	})
}

/**
 * Called when a websocket connects.
 * @param session
 * @param socket
 */
async function OnConnect(session: Session, socket: WebSocket, req: Request) {
	let roomName = req.url!.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}`)
	let client = new Client(session, socket);
	connections.push(client);
	socket.on("ping", (data) => client.OnPing(data));
	socket.on("message", (data) => client.OnMessage(data as string));
	try {
		await client.JoinRoom(roomName);
	}
	catch (e) {
		log.error(`Failed to join room: ${e.message}`);
		if (e instanceof RoomNotFoundException) {
			socket.close(OttWebsocketError.ROOM_NOT_FOUND);
		} else {
			socket.close(OttWebsocketError.UNKNOWN);
		}
	}
}

redisSubscriber.on("message", async (channel, text) => {
	// handles sync messages published by the rooms.
	log.debug(`pubsub message: ${channel}: ${text}`);
	if (!channel.startsWith("room:")) {
		return;
	}
	let roomName = channel.replace("room:", "")
	let msg = JSON.parse(text) as ServerMessage;
	if (msg.action === "sync") {
		let state = roomStates.get(roomName!);
		if (state === undefined) {
			let stateText = await get(`room:${roomName}`);
			state = JSON.parse(stateText!)! as RoomState;
		}
		Object.assign(state, _.omit(msg, "action"))
		roomStates.set(roomName!, state);

		for (let client of roomJoins.get(roomName)!) {
			try {
				client.Socket.send(text);
			}
			catch (e) {
				log.error(`failed to send to client: ${e.message}`);
			}
		}
	}
	else if (msg.action === "unload") {
		for (let client of roomJoins.get(roomName)!) {
			client.Socket.close(OttWebsocketError.ROOM_UNLOADED, "The room was unloaded.");
		}
	}
});

export default {
	Setup,
}
