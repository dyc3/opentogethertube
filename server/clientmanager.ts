import { Session } from "express-session";
import WebSocket from "ws";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { Request } from 'express';
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { ClientMessage, RoomRequest, RoomRequestType, ServerMessage, ServerMessageSync } from "./messages";
import { RoomNotFoundException } from "./exceptions";
import { ClientInfo, RoomState, MySession, OttWebsocketError, ClientId } from "./types";
// WARN: do NOT import roommanager
import roommanager from "./roommanager"; // this is temporary because these modules are supposed to be completely isolated. In the future, it should send room requests via the HTTP API to other nodes.

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const get = promisify(redisClient.get).bind(redisClient);
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(redisSubscriber);
const connections: Client[] = [];
const roomStates: Map<string, RoomState> = new Map();
const roomJoins: Map<string, Client[]> = new Map();

export class Client {
	id: ClientId
	Socket: WebSocket
	Session: MySession
	room: string | null

	constructor (session: MySession, socket: WebSocket) {
		this.id = _.uniqueId(); // maybe use uuidv4 from uuid package instead?
		this.Session = session;
		this.Socket = socket;
		this.room = null;

		this.Socket.on("close", async (code, reason) => {
			log.debug(`socket closed: ${code}, ${reason}`);
			const idx = _.findIndex(connections, { id: this.id });
			connections.splice(idx, 1);

			if (this.room) {
				const room = await roommanager.GetRoom(this.room);
				await room.processRequest({
					type: RoomRequestType.LeaveRequest,
					client: this.id,
				});
			}
		});
	}

	get clientInfo(): ClientInfo {
		if (this.Session.passport && this.Session.passport.user) {
			return {
				id: this.id,
				user_id: this.Session.passport.user,
			};
		}
		else if (this.Session.username) {
			return {
				id: this.id,
				username: this.Session.username,
			};
		}
		else {
			throw new TypeError("Session did not have username present, nor passport user id");
		}
	}

	public async OnMessage(text: string): Promise<void> {
		log.debug(text);
		const msg: ClientMessage = JSON.parse(text);
		let request: RoomRequest | null = null;
		if (msg.action === "play") {
			request = {
				type: RoomRequestType.PlaybackRequest,
				client: this.id,
				state: true,
			};
		}
		else if (msg.action === "pause") {
			request = {
				type: RoomRequestType.PlaybackRequest,
				client: this.id,
				state: false,
			};
		}
		else if (msg.action === "skip") {
			request = {
				type: RoomRequestType.SkipRequest,
				client: this.id,
			};
		}
		else if (msg.action === "seek") {
			request = {
				type: RoomRequestType.SeekRequest,
				client: this.id,
				value: msg.position,
			};
		}
		else if (msg.action === "queue-move") {
			request = {
				type: RoomRequestType.OrderRequest,
				client: this.id,
				fromIdx: msg.currentIdx,
				toIdx: msg.targetIdx,
			};
		}
		else if (msg.action === "kickme") {
			this.Socket.close(OttWebsocketError.UNKNOWN);
			return;
		}
		else {
			log.warn(`Unknown message: ${msg.action}`);
			return;
		}

		try {
			await this.makeRoomRequest(request);
		}
		catch (e) {
			log.error(`Room request failed: ${e} ${e.stack}`);
		}
	}

	public OnPing(data: Buffer): void {
		log.debug(`sending pong`);
		this.Socket.pong();
	}

	public async JoinRoom(roomName: string): Promise<void> {
		log.debug(`client id=${this.id} joining ${roomName}`);
		this.room = roomName;

		const room = await roommanager.GetRoom(roomName);
		if (!room) {
			throw new RoomNotFoundException(roomName);
		}
		// full sync
		let state = roomStates.get(roomName);
		if (state === undefined) {
			log.warn("room state not present, grabbing");
			const stateText = await get(`room:${roomName}`);
			state = JSON.parse(stateText);
			roomStates.set(roomName, state);
		}
		const syncMsg: ServerMessageSync = Object.assign({action: "sync"}, state) as ServerMessageSync;
		this.Socket.send(JSON.stringify(syncMsg));

		// actually join the room
		await room.processRequest({
			type: RoomRequestType.JoinRequest,
			client: this.id,
			info: this.clientInfo,
		});
		subscribe(`room:${roomName}`);
		let clients = roomJoins.get(roomName);
		if (clients === undefined) {
			log.warn("room joins not present, creating");
			clients = [];
		}
		clients.push(this);
		roomJoins.set(roomName, clients);
	}

	public async makeRoomRequest(request: RoomRequest): Promise<void> {
		const room = await roommanager.GetRoom(this.room); // FIXME: only get room if it is loaded already.
		if (!room) {
			throw new RoomNotFoundException(this.room);
		}
		await room.processRequest(request);
	}
}

export function Setup(): void {
	log.debug("setting up client manager...");
	const server = wss as WebSocket.Server;
	server.on("connection", async (ws, req: Request & { session: Session }) => {
		if (!req.url.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await OnConnect(req.session, ws, req);
	});
}

/**
 * Called when a websocket connects.
 * @param session
 * @param socket
 */
async function OnConnect(session: Session, socket: WebSocket, req: Request) {
	const roomName = req.url.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}`);
	const client = new Client(session as MySession, socket);
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
		}
 else {
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
	const roomName = channel.replace("room:", "");
	const msg = JSON.parse(text) as ServerMessage;
	if (msg.action === "sync") {
		let state = roomStates.get(roomName);
		if (state === undefined) {
			const stateText = await get(`room:${roomName}`);
			state = JSON.parse(stateText) as RoomState;
		}
		Object.assign(state, _.omit(msg, "action"));
		roomStates.set(roomName, state);

		for (const client of roomJoins.get(roomName)) {
			try {
				client.Socket.send(text);
			}
			catch (e) {
				log.error(`failed to send to client: ${e.message}`);
			}
		}
	}
	else if (msg.action === "unload") {
		for (const client of roomJoins.get(roomName)) {
			client.Socket.close(OttWebsocketError.ROOM_UNLOADED, "The room was unloaded.");
		}
	}
});

async function onUserModified(session: MySession, newUsername: string) {
	log.debug(`User was modified: ${session}, newUsername=${newUsername}, telling rooms`);
	for (const client of connections) {
		if (client.Session.id === session.id) {
			client.Session = session;
			await client.makeRoomRequest({
				type: RoomRequestType.UpdateUser,
				client: client.id,
				info: client.clientInfo,
			});
		}
	}
}

export default {
	Setup,
	onUserModified,
};
