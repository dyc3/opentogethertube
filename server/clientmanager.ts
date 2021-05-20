import { Session } from "express-session";
import WebSocket from "ws";
import { uniqueNamesGenerator } from "unique-names-generator";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { json, Request } from 'express';
import { redisClient, createSubscriber } from "../redisclient";
import { promisify } from "util";
import { ServerMessage, ServerMessageSync } from "./messages";
import { RoomState } from "./room.js";
import { RoomNotFoundException } from "./exceptions";
// WARN: do NOT import roommanager

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
	Socket: WebSocket
	Session: Session
	User: any
	UnregisteredUsername: string | null

	constructor (session: Session, socket: WebSocket) {
		this.Session = session;
		this.Socket = socket;
		this.UnregisteredUsername = uniqueNamesGenerator()

		this.Socket.on("close", (code, reason) => {
			let idx = _.findIndex(connections, { Session: this.Session });
			connections.splice(idx, 1)
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

	public OnMessage(text: string) {
		let msg = JSON.parse(text) as ServerMessage;
		switch (msg.action) {
			default:
				log.warn(`Unknown message: ${msg.action}`);
				break;
		}
	}

	public OnPing(data: Buffer) {
		log.debug(`sending pong`);
		this.Socket.pong();
	}

	public async JoinRoom(room: string) {
		log.info(`${this.Username} joining ${room}`);

		// full sync
		let state = roomStates.get(room);
		if (state === undefined) {
			log.warn("room state not present, grabbing")
			let stateText = await get(`room:${room}`);
			if (stateText === null) {
				throw new RoomNotFoundException(room);
			}
			state = JSON.parse(stateText)!;
		}
		let syncMsg: ServerMessageSync = Object.assign({action: "sync"}, state) as ServerMessageSync;
		this.Socket.send(JSON.stringify(syncMsg));

		// actually join the room
		subscribe(`room:${room}`);
		let clients = roomJoins.get(room);
		if (clients === undefined) {
			log.warn("room joins not present, creating")
			clients = [];
		}
		clients.push(this);
		roomJoins.set(room, clients);
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
	socket.on("ping", client.OnPing);
	socket.on("message", client.OnMessage);
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

redisClient.on("message", function(channel, text) {
	log.debug(`pubsub message: ${channel}: ${text}`);
	if (!channel.startsWith("room:")) {
		return;
	}
	let msg = JSON.parse(text) as ServerMessage;
	if (msg.action === "sync") {
		let state = roomStates.get(msg.name!);
		if (state === undefined) {
			state = {} as RoomState;
		}
		Object.assign(state, _.omit(msg, "action"))
		roomStates.set(msg.name!, state);
	}
});

export default {
	Setup,
}
