import { Session } from "express-session";
import WebSocket from "ws";
import { uniqueNamesGenerator } from "unique-names-generator";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { Request } from 'express';
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { ClientMessage, ClientMessageSeek, RoomRequest, RoomRequestType, ServerMessage, ServerMessageSync } from "./messages";
import { RoomNotFoundException } from "./exceptions";
import { ClientInfo, RoomState, MySession, OttWebsocketError } from "./types";
// WARN: do NOT import roommanager
import roommanager from "./roommanager" // this is temporary because these modules are supposed to be completely isolated. In the future, it should send room requests via the HTTP API to other nodes.

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const get = promisify(redisClient.get).bind(redisClient);
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(redisSubscriber);
let connections: Client[] = [];
let roomStates: Map<string, RoomState> = new Map();
let roomJoins: Map<string, Client[]> = new Map();

export class Client {
	id: string
	Socket: WebSocket
	Session: MySession
	room: string | null

	constructor (session: MySession, socket: WebSocket) {
		this.id = _.uniqueId(); // maybe use uuidv4 from uuid package instead?
		this.Session = session;
		this.Socket = socket;
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

	get clientInfo(): ClientInfo {
		if (this.Session.passport?.user) {
			return {
				id: this.id,
				user_id: this.Session.passport.user
			}
		}
		else if (this.Session.username) {
			return {
				id: this.id,
				username: this.Session.username,
			}
		}
		else {
			throw new TypeError("Session did not have username present, nor passport user id");
		}
	}

	public async OnMessage(text: string) {
		log.debug(text);
		let msg: ClientMessage = JSON.parse(text);
		if (msg.action === "play") {
			await this.makeRoomRequest({
				type: RoomRequestType.PlaybackRequest,
				permission: "playback.play-pause",
				state: true,
			})
		}
		else if (msg.action === "pause") {
			await this.makeRoomRequest({
				type: RoomRequestType.PlaybackRequest,
				permission: "playback.play-pause",
				state: false,
			})
		}
		else if (msg.action === "skip") {
			await this.makeRoomRequest({
				type: RoomRequestType.SkipRequest,
				permission: "playback.skip",
			})
		}
		else if (msg.action === "seek") {
			await this.makeRoomRequest({
				type: RoomRequestType.SeekRequest,
				permission: "playback.seek",
				value: msg.position,
			})
		}
		else if (msg.action === "queue-move") {
			await this.makeRoomRequest({
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
		log.debug(`client id=${this.id} joining ${roomName}`);
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
			info: this.clientInfo,
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

	public async makeRoomRequest(request: RoomRequest) {
		let room = await roommanager.GetRoom(this.room!); // FIXME: only get room if it is loaded already.
		if (!room) {
			log.error(`room not found: ${this.room}`)
		}
		await room?.processRequest(request);
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
	let client = new Client(session as MySession, socket);
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

async function onUserModified(session: MySession, newUsername: string) {
	log.debug(`User was modified: ${session}, newUsername=${newUsername}, telling rooms`)
	for (let client of connections) {
		if (client.Session.id === session.id) {
			client.Session = session;
			await client.makeRoomRequest({
				type: RoomRequestType.UpdateUser,
				info: client.clientInfo,
			})
		}
	}
}

export default {
	Setup,
	onUserModified,
}
