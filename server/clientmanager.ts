import express from "express";
import WebSocket from "ws";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { Request } from 'express';
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { ClientMessage, RoomRequest, RoomRequestType, ServerMessage, ServerMessageSync } from "../common/models/messages";
import { ClientNotFoundInRoomException, RoomNotFoundException } from "./exceptions";
import { ClientInfo, MySession, OttWebsocketError, ClientId, RoomStateSyncable, AuthToken } from "../common/models/types";
// WARN: do NOT import roommanager
import roommanager from "./roommanager"; // this is temporary because these modules are supposed to be completely isolated. In the future, it should send room requests via the HTTP API to other nodes.
import { ANNOUNCEMENT_CHANNEL } from "../common/constants";
import { uniqueNamesGenerator } from 'unique-names-generator';
import tokens, { SessionInfo } from "./auth/tokens";

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const get = promisify(redisClient.get).bind(redisClient);
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(redisSubscriber);
const connections: Client[] = [];
const roomStates: Map<string, RoomStateSyncable> = new Map();
const roomJoins: Map<string, Client[]> = new Map();
subscribe(ANNOUNCEMENT_CHANNEL);

export class Client {
	id: ClientId
	Socket: WebSocket
	Session?: SessionInfo
	room: string
	token: AuthToken | null = null

	constructor (socket: WebSocket, roomName: string) {
		this.id = _.uniqueId(); // maybe use uuidv4 from uuid package instead?
		this.Socket = socket;
		this.room = roomName;

		this.Socket.on("close", async (code, reason) => {
			log.debug(`socket closed: ${code}, ${reason}`);
			const idx = _.findIndex(connections, { id: this.id });
			connections.splice(idx, 1);

			if (this.room) {
				if (this.token) {
					// only send leave if the client has actually joined the room
					const room = await roommanager.GetRoom(this.room);
					await room.processRequest({
						type: RoomRequestType.LeaveRequest,
						token: this.token,
						client: this.id,
					});
				}
			}
		});
	}

	get clientInfo(): ClientInfo {
		if (!this.Session) {
			throw new Error("session info not present");
		}
		if (this.Session.isLoggedIn) {
			return {
				id: this.id,
				user_id: this.Session.user_id,
			};
		}
		else {
			return {
				id: this.id,
				// @ts-expect-error FIXME: remove this comment when strict-null-checks are enabled
				username: this.Session.username,
			};
		}
	}

	public async OnMessage(text: string): Promise<void> {
		log.silly(`client message: ${text}`);
		const msg: ClientMessage = JSON.parse(text);
		let request: RoomRequest | null = null;
		if (this.token === null) {
			if (msg.action === "auth") {
				this.token = msg.token;
				this.Session = await tokens.getSessionInfo(this.token);
				log.debug("received auth token, joining room");
				try {
					await this.JoinRoom(this.room);
				}
				catch (e) {
					if (e instanceof RoomNotFoundException) {
						log.info(`Failed to join room: ${e.message}`);
						this.Socket.close(OttWebsocketError.ROOM_NOT_FOUND);
					}
					else {
						if (e instanceof Error) {
							log.error(`Failed to join room: ${e.stack}`);
						}
						this.Socket.close(OttWebsocketError.UNKNOWN);
					}
				}
				return;
			}
			else {
				log.error(`received message before auth: ${text}`);
				this.Socket.close(OttWebsocketError.MISSING_AUTH);
				return;
			}
		}
		if (msg.action === "play") {
			request = {
				type: RoomRequestType.PlaybackRequest,
				token: this.token,
				state: true,
			};
		}
		else if (msg.action === "pause") {
			request = {
				type: RoomRequestType.PlaybackRequest,
				token: this.token,
				state: false,
			};
		}
		else if (msg.action === "skip") {
			request = {
				type: RoomRequestType.SkipRequest,
				token: this.token,
			};
		}
		else if (msg.action === "seek") {
			request = {
				type: RoomRequestType.SeekRequest,
				token: this.token,
				value: msg.position,
			};
		}
		else if (msg.action === "queue-move") {
			request = {
				type: RoomRequestType.OrderRequest,
				token: this.token,
				fromIdx: msg.currentIdx,
				toIdx: msg.targetIdx,
			};
		}
		else if (msg.action === "kickme") {
			this.Socket.close(OttWebsocketError.UNKNOWN);
			return;
		}
		else if (msg.action === "chat") {
			request = {
				type: RoomRequestType.ChatRequest,
				token: this.token,
				...msg,
			};
		}
		else if (msg.action === "status") {
			request = {
				type: RoomRequestType.UpdateUser,
				token: this.token,
				info: {
					id: this.id,
					status: msg.status,
				},
			};
		}
		else if (msg.action === "set-role") {
			request = {
				type: RoomRequestType.PromoteRequest,
				token: this.token,
				targetClientId: msg.clientId,
				role: msg.role,
			};
		}
		else if (msg.action === "play-now") {
			request = {
				type: RoomRequestType.PlayNowRequest,
				token: this.token,
				video: msg.video,
			};
		}
		else {
			log.warn(`Unknown client message: ${(msg as { action: string }).action}`);
			return;
		}

		try {
			await this.makeRoomRequest(request);
		}
		catch (e) {
			if (e instanceof Error) {
				log.error(`Room request ${request.type} failed: ${e.message} ${e.stack}`);
			}
			else {
				log.error(`Room request ${request.type} failed`);
			}
		}
	}

	public OnPing(data: Buffer): void {
		log.debug(`sending pong`);
		this.Socket.pong();
	}

	public async JoinRoom(roomName: string): Promise<void> {
		if (!this.token) {
			throw new Error("No token, client needs to send auth message first");
		}
		log.debug(`client id=${this.id} joining ${roomName}`);
		if (!this.Session) {
			this.Session = await tokens.getSessionInfo(this.token);
		}

		const room = await roommanager.GetRoom(roomName);
		if (!room) {
			throw new RoomNotFoundException(roomName);
		}
		this.room = room.name;
		// full sync
		let state = roomStates.get(room.name);
		if (state === undefined) {
			log.warn("room state not present, grabbing");
			const stateText = await get(`room-sync:${room.name}`);
			let loadedstate = JSON.parse(stateText);
			roomStates.set(room.name, loadedstate);
			state = loadedstate;
		}
		const syncMsg: ServerMessageSync = Object.assign({action: "sync"}, state) as ServerMessageSync;
		this.Socket.send(JSON.stringify(syncMsg));

		// actually join the room
		await subscribe(`room:${room.name}`);
		let clients = roomJoins.get(room.name);
		if (clients === undefined) {
			log.warn("room joins not present, creating");
			clients = [];
		}
		clients.push(this);
		roomJoins.set(room.name, clients);
		await this.makeRoomRequest({
			type: RoomRequestType.JoinRequest,
			token: this.token,
			info: this.clientInfo,
		});
	}

	public async makeRoomRequest(request: RoomRequest): Promise<void> {
		// FIXME: what if the room is not loaded on this node, but it's on a different node instead?
		// FIXME: only get room if it is loaded already.
		const room = await roommanager.GetRoom(this.room);
		if (!room) {
			throw new RoomNotFoundException(this.room);
		}
		await room.processRequest(request);
	}

	public sendObj(obj: any): void {
		try {
			this.Socket.send(JSON.stringify(obj));
		}
		catch (e) {
			if (e instanceof Error) {
				log.error(`failed to send to client: ${e.message}`);
			}
			else {
				log.error(`failed to send to client`);
			}
		}
	}
}

export function Setup(): void {
	log.debug("setting up client manager...");
	const server = wss;
	server.on("connection", async (ws, req: Request & { session: MySession }) => {
		if (!req.url.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await OnConnect(ws, req);
	});
}

/**
 * Called when a websocket connects.
 * @param socket
 */
async function OnConnect(socket: WebSocket, req: express.Request) {
	const roomName = req.url.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}, waiting for auth token...`);
	const client = new Client(socket, roomName);
	connections.push(client);
	socket.on("ping", (data) => client.OnPing(data));
	socket.on("message", (data) => client.OnMessage(data as string));
}

async function broadcast(roomName: string, text: string) {
	let clients = roomJoins.get(roomName);
	if (!clients) {
		return;
	}
	for (const client of clients) {
		try {
			client.Socket.send(text);
		}
		catch (e) {
			if (e instanceof Error) {
				log.error(`failed to send to client: ${e.message}`);
			}
			else {
				log.error(`failed to send to client`);
			}
		}
	}
}

async function onRedisMessage(channel: string, text: string) {
	// handles sync messages published by the rooms.
	log.silly(`pubsub message: ${channel}: ${text.substr(0, 200)}`);
	const msg = JSON.parse(text) as ServerMessage;
	if (channel.startsWith("room:")) {
		const roomName = channel.replace("room:", "");
		if (msg.action === "sync") {
			let state = roomStates.get(roomName);
			if (state === undefined) {
				const stateText = await get(`room-sync:${roomName}`);
				state = JSON.parse(stateText) as RoomStateSyncable;
			}
			const filtered = _.omit(msg, "action");
			if (state) {
				Object.assign(state, filtered);
			}
			else {
				state = filtered as RoomStateSyncable;
			}
			roomStates.set(roomName, state);

			await broadcast(roomName, text);
		}
		else if (msg.action === "unload") {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			for (const client of roomJoins.get(roomName) as Client[]) {
				client.Socket.close(OttWebsocketError.ROOM_UNLOADED, "The room was unloaded.");
			}
		}
		else if (msg.action === "chat") {
			await broadcast(roomName, text);
		}
		else if (msg.action === "event") {
			await broadcast(roomName, text);
		}
		else if (msg.action === "user") {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
			for (const client of roomJoins.get(roomName) as Client[]) {
				if (msg.user.id === client.id) {
					msg.user.isYou = true;
					client.sendObj(msg);
					break;
				}
			}
		}
		else {
			log.error(`Unknown server message: ${(msg as { action: string }).action}`);
		}
	}
	else if (channel === ANNOUNCEMENT_CHANNEL) {
		for (const client of connections) {
			try {
				client.Socket.send(text);
			}
			catch (e) {
				if (e instanceof Error) {
					log.error(`failed to send to client: ${e.message}`);
				}
				else {
					log.error(`failed to send to client`);
				}
			}
		}
	}
	else {
		log.error(`Unhandled message from redis channel: ${channel}`);
	}
}

redisSubscriber.on("message", onRedisMessage);

async function onUserModified(token: AuthToken): Promise<void> {
	log.debug(`User was modified, telling rooms`);
	for (const client of connections) {
		if (client.token === token) {
			await client.makeRoomRequest({
				type: RoomRequestType.UpdateUser,
				token: token,
				info: client.clientInfo,
			});
		}
	}
}

function getClient(token: AuthToken, roomName: string): Client {
	for (const client of connections) {
		if (!client.token) {
			continue;
		}
		if (client.token === token && client.room === roomName) {
			return client;
		}
	}
	throw new ClientNotFoundInRoomException(roomName);
}

setInterval(() => {
	for (const client of connections) {
		client.Socket.ping();
	}
}, 10000);

export default {
	Setup,
	onUserModified,
	getClient,
};
