import express from "express";
import WebSocket from "ws";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "./logger.js";
import { Request } from "express";
import { createSubscriber, redisClientAsync } from "./redisclient";
import { promisify } from "util";
import {
	ClientMessage,
	RoomRequest,
	RoomRequestType,
	ServerMessage,
	ServerMessageSync,
} from "../common/models/messages";
import { ClientNotFoundInRoomException, RoomNotFoundException } from "./exceptions";
import { InvalidTokenException } from "../common/exceptions";
import {
	ClientInfo,
	MySession,
	OttWebsocketError,
	ClientId,
	AuthToken,
	Role,
} from "../common/models/types";
import roommanager from "./roommanager";
import { ANNOUNCEMENT_CHANNEL } from "../common/constants";
import { uniqueNamesGenerator } from "unique-names-generator";
import tokens, { SessionInfo } from "./auth/tokens";
import { RoomStateSyncable } from "./room";
import { Gauge } from "prom-client";
import { replacer } from "../common/serialize";

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(
	redisSubscriber
);
const connections: Client[] = [];
const roomStates: Map<string, RoomStateSyncable> = new Map();
const roomJoins: Map<string, Client[]> = new Map();
subscribe(ANNOUNCEMENT_CHANNEL);

export class Client {
	id: ClientId;
	socket: WebSocket;
	session?: SessionInfo;
	room: string;
	token: AuthToken | null = null;

	constructor(roomName: string, socket: WebSocket) {
		this.id = _.uniqueId(); // maybe use uuidv4 from uuid package instead?
		this.socket = socket;
		this.room = roomName;

		this.socket.on("close", async (code, reason) => {
			log.debug(`socket closed: ${code}, ${reason}`);
			const idx = _.findIndex(connections, { id: this.id });
			connections.splice(idx, 1);

			if (this.token) {
				try {
					const room = await roommanager.getRoom(this.room);
					// it's safe to bypass authenticating the leave request because this event is only triggered by the socket closing
					await room.processRequestUnsafe(
						{
							type: RoomRequestType.LeaveRequest,
						},
						this.id
					);
				} catch (e) {
					if (e instanceof Error) {
						log.warn(
							`Failed to make leave request: "${e.name}: ${e.message}" This is not a critical error, so we will continue.`
						);
					} else {
						log.warn(
							`Failed to make leave request. This is not a critical error, so we will continue.`
						);
					}
				}
			}
		});
	}

	get clientInfo(): ClientInfo {
		if (!this.session) {
			throw new Error("No session info present");
		}
		if (this.session.isLoggedIn) {
			return {
				id: this.id,
				user_id: this.session.user_id,
			};
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
		else if (this.session.isLoggedIn === false) {
			// this is a workaround because typescript doesn't narrow the type correctly
			return {
				id: this.id,
				username: this.session.username,
			};
		} else {
			log.error(
				"Session did not have username present, nor passport user id. Generating username..."
			);
			return {
				id: this.id,
				username: uniqueNamesGenerator(),
			};
		}
	}

	public async onMessage(text: string): Promise<void> {
		log.silly(`client message: ${text}`);
		try {
			const msg: ClientMessage = JSON.parse(text);

			let request: RoomRequest | null = null;
			if (msg.action === "kickme") {
				this.socket.close(msg.reason ?? OttWebsocketError.UNKNOWN);
				return;
			} else if (msg.action === "status") {
				request = {
					type: RoomRequestType.UpdateUser,
					info: {
						id: this.id,
						status: msg.status,
					},
				};
			} else if (msg.action === "auth") {
				this.token = msg.token;
				log.debug("received auth token, joining room");
				try {
					await this.joinRoom(this.room);
				} catch (e) {
					if (e instanceof RoomNotFoundException) {
						log.info(`Failed to join room: ${e.message}`);
						this.socket.close(OttWebsocketError.ROOM_NOT_FOUND);
					} else if (e instanceof InvalidTokenException) {
						log.info(`Failed to join room: ${e.message}`);
						this.socket.close(OttWebsocketError.MISSING_TOKEN);
					} else {
						if (e instanceof Error) {
							log.error(`Failed to join room: ${e.stack}`);
						}
						this.socket.close(OttWebsocketError.UNKNOWN);
					}
				}
				return;
			} else if (msg.action === "req") {
				request = msg.request;
			} else {
				log.warn(`Unknown client message: ${(msg as { action: string }).action}`);
				return;
			}

			try {
				await this.makeRoomRequest(request);
			} catch (e) {
				if (e instanceof Error) {
					log.error(`Room request ${request.type} failed: ${e.message} ${e.stack}`);
				} else {
					log.error(`Room request ${request.type} failed`);
				}
			}
		} catch (e) {
			log.error(`Failed to handle websocket message: ${text} - ${e}`);
			return;
		}
	}

	public onPing(data: Buffer): void {
		log.debug(`sending pong`);
		this.socket.pong();
	}

	public async joinRoom(roomName: string): Promise<void> {
		log.debug(`client id=${this.id} joining ${roomName}`);
		if (!this.token) {
			log.error("No token present, cannot join room");
			throw new InvalidTokenException();
		}
		if (!this.session) {
			this.session = await tokens.getSessionInfo(this.token);
		}

		const room = await roommanager.getRoom(roomName);
		if (!room) {
			throw new RoomNotFoundException(roomName);
		}
		this.room = room.name;
		// full sync
		let state = roomStates.get(room.name);
		if (state === undefined) {
			log.warn("room state not present, grabbing");
			const stateText = await redisClientAsync.get(`room-sync:${room.name}`);
			state = JSON.parse(stateText) as RoomStateSyncable;
			roomStates.set(room.name, state);
		}
		const syncMsg: ServerMessageSync = Object.assign(
			{ action: "sync" },
			state
		) as ServerMessageSync;
		this.socket.send(JSON.stringify(syncMsg));

		// actually join the room
		let clients = roomJoins.get(room.name);
		if (clients === undefined) {
			log.warn("room joins not present, creating");
			clients = [];
			roomJoins.set(room.name, clients);
		}
		clients.push(this);
		await this.makeRoomRequest({
			type: RoomRequestType.JoinRequest,
			token: this.token,
			info: this.clientInfo,
		});
	}

	public async makeRoomRequest(request: RoomRequest): Promise<void> {
		if (!this.token) {
			throw new Error("No token present");
		}
		try {
			// Happy path: avoid serializing and deserializing the request if its not needed.
			const room = await roommanager.getRoom(this.room, {
				mustAlreadyBeLoaded: true,
			});
			await room.processUnauthorizedRequest(request, {
				token: this.token,
			});
		} catch (e) {
			log.error(`Failed to process room request: ${e}`);
		}
	}

	public sendObj(obj: any): void {
		try {
			this.socket.send(JSON.stringify(obj));
		} catch (e) {
			if (e instanceof Error) {
				log.error(`failed to send to client: ${e.message}`);
			} else {
				log.error(`failed to send to client`);
			}
		}
	}
}

export function setup(): void {
	log.debug("setting up client manager...");
	const server = wss;
	server.on("connection", async (ws, req: Request & { session: MySession }) => {
		if (!req.url.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await onConnect(ws, req);
	});
	roommanager.on("publish", onRoomPublish);
	roommanager.on("unload", onRoomUnload);
}

/**
 * Called when a websocket connects.
 * @param socket
 */
async function onConnect(socket: WebSocket, req: express.Request) {
	const roomName = req.url.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}, waiting for auth token...`);
	const client = new Client(roomName, socket);
	connections.push(client);
	socket.on("ping", data => client.onPing(data));
	socket.on("message", data => client.onMessage(data as string));
	socket.on("error", e => {
		log.warn(`websocket error: ${e}`);
	});
}

async function broadcast(roomName: string, text: string) {
	const clients = roomJoins.get(roomName);
	if (!clients) {
		return;
	}
	for (const client of clients) {
		try {
			client.socket.send(text);
		} catch (e) {
			if (e instanceof Error) {
				log.error(`failed to send to client: ${e.message}`);
			} else {
				log.error(`failed to send to client`);
			}
		}
	}
}

async function onRoomPublish(roomName: string, msg: ServerMessage) {
	const text = JSON.stringify(msg, replacer);
	if (msg.action === "sync") {
		let state = roomStates.get(roomName);
		if (state === undefined) {
			const stateText = await redisClientAsync.get(`room-sync:${roomName}`);
			state = JSON.parse(stateText) as RoomStateSyncable;
		}
		const filtered = _.omit(msg, "action");
		if (state) {
			Object.assign(state, filtered);
		} else {
			// @ts-expect-error
			state = filtered;
		}
		if (!state) {
			throw new Error("state is still undefined, can't broadcast to clients");
		}
		roomStates.set(roomName, state);

		await broadcast(roomName, text);
	} else if (msg.action === "chat") {
		await broadcast(roomName, text);
	} else if (msg.action === "event" || msg.action === "eventcustom") {
		await broadcast(roomName, text);
	} else if (msg.action === "user") {
		const clients = roomJoins.get(roomName);
		if (!clients) {
			return;
		}
		for (const client of clients) {
			if (msg.user.id === client.id) {
				msg.user.isYou = true;
				client.sendObj(msg);
				break;
			}
		}
	} else {
		log.error(`Unknown server message: ${(msg as { action: string }).action}`);
	}
}

function onRoomUnload(roomName: string) {
	const clients = roomJoins.get(roomName);
	if (clients) {
		for (const client of clients) {
			client.socket.close(OttWebsocketError.ROOM_UNLOADED, "The room was unloaded.");
		}
	}

	roomJoins.delete(roomName);
	roomStates.delete(roomName);
}

async function onRedisMessage(channel: string, text: string) {
	// handles sync messages published by the rooms.
	log.silly(`pubsub message: ${channel}: ${text.substr(0, 200)}`);
	const msg = JSON.parse(text) as ServerMessage;
	if (channel.startsWith("room:")) {
		const roomName = channel.replace("room:", "");
	} else if (channel === ANNOUNCEMENT_CHANNEL) {
		for (const client of connections) {
			try {
				client.socket.send(text);
			} catch (e) {
				if (e instanceof Error) {
					log.error(`failed to send to client: ${e.message}`);
				} else {
					log.error(`failed to send to client`);
				}
			}
		}
	} else {
		log.error(`Unhandled message from redis channel: ${channel}`);
	}
}

redisSubscriber.on("message", onRedisMessage);

async function onUserModified(token: AuthToken): Promise<void> {
	log.debug(`User was modified, pulling info and telling rooms`);
	for (const client of connections) {
		if (client.token === token) {
			client.session = await tokens.getSessionInfo(token);
			await client.makeRoomRequest({
				type: RoomRequestType.UpdateUser,
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
		client.socket.ping();
	}
}, 10000);

const gaugeWebsocketConnections = new Gauge({
	name: "ott_websocket_connections",
	help: "The number of active websocket connections",
	collect() {
		this.set(connections.length);
	},
});

export default {
	setup,
	onUserModified,
	getClient,
};
