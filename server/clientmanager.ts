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
import { Client, ClientJoinStatus, DirectClient, BalancerClient } from "./client";
import { BalancerConnection, MsgB2M, balancerManager, initBalancerConnections } from "./balancer";

const log = getLogger("clientmanager");
const redisSubscriber = createSubscriber();
const subscribe: (channel: string) => Promise<string> = promisify(redisSubscriber.subscribe).bind(
	redisSubscriber
);
const connections: Client[] = [];
const roomStates: Map<string, RoomStateSyncable> = new Map();
const roomJoins: Map<string, Client[]> = new Map();
subscribe(ANNOUNCEMENT_CHANNEL);

export function setup(): void {
	log.debug("setting up client manager...");
	const server = wss;
	server.on("connection", async (ws, req: Request & { session: MySession }) => {
		if (!req.url.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await onDirectConnect(ws, req);
	});
	roommanager.on("publish", onRoomPublish);
	roommanager.on("unload", onRoomUnload);

	balancerManager.on("connect", onBalancerConnect);
	balancerManager.on("disconnect", onBalancerDisconnect);
	balancerManager.on("message", onBalancerMessage);
	balancerManager.on("error", onBalancerError);
	initBalancerConnections();
}

/**
 * Called when a websocket connects.
 * @param socket
 */
async function onDirectConnect(socket: WebSocket, req: express.Request) {
	const roomName = req.url.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}, waiting for auth token...`);
	const client = new DirectClient(roomName, socket);
	connections.push(client);
	client.on("auth", onClientAuth);
	client.on("message", onClientMessage);
	client.on("disconnect", onClientDisconnect);
}

async function onClientAuth(client: Client, token: AuthToken, session: SessionInfo) {
	const result = await roommanager.getRoom(client.room);
	if (!result.ok) {
		client.kick(OttWebsocketError.ROOM_NOT_FOUND);
		return;
	}
	const room = result.value;
	client.room = room.name;

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
	client.send(syncMsg);

	// actually join the room
	let clients = roomJoins.get(room.name);
	if (clients === undefined) {
		log.warn("room joins not present, creating");
		clients = [];
		roomJoins.set(room.name, clients);
	}
	clients.push(client);
	await makeRoomRequest(client, {
		type: RoomRequestType.JoinRequest,
		token: token,
		info: client.getClientInfo(),
	});
}

async function onClientMessage(client: Client, msg: ClientMessage) {
	if (msg.action === "kickme") {
		client.kick(msg.reason ?? OttWebsocketError.UNKNOWN);
		return;
	} else if (msg.action === "status") {
		let request: RoomRequest = {
			type: RoomRequestType.UpdateUser,
			info: {
				id: client.id,
				status: msg.status,
			},
		};
		await makeRoomRequest(client, request);
	} else if (msg.action === "req") {
		await makeRoomRequest(client, msg.request);
	} else {
		log.warn(`Unknown client message: ${(msg as { action: string }).action}`);
		return;
	}
}

async function onClientDisconnect(client: Client) {
	const index = connections.indexOf(client);
	if (index !== -1) {
		let clients = connections.splice(index, 1);
		if (clients.length !== 1) {
			log.error("failed to remove client from connections");
			return;
		}
		let client = clients[0];
		let joins = roomJoins.get(client.room);
		if (joins) {
			const index = joins.indexOf(client);
			if (index !== -1) {
				joins.splice(index, 1);
			}
		}
	}

	const result = await roommanager.getRoom(client.room, { mustAlreadyBeLoaded: true });
	if (!result.ok) {
		log.error(`Failed to get room ${client.room} when processing disconnect`);
		return;
	}
	const room = result.value;
	// it's safe to bypass authenticating the leave request because this event is only triggered by the socket closing
	try {
		await room.processRequestUnsafe(
			{
				type: RoomRequestType.LeaveRequest,
			},
			client.id
		);
	} catch (err) {
		log.error(`Failed to process leave request for client ${client.id}: ${err}`);
	}
}

function onBalancerConnect(conn: BalancerConnection) {
	log.info(`Connected to balancer ${conn.id}`);
}

function onBalancerDisconnect(conn: BalancerConnection) {
	log.info(`Disconnected from balancer ${conn.id}`);
	// TODO: remove all clients from this balancer
	// TODO: handle reconnecting
}

function onBalancerMessage(conn: BalancerConnection, message: MsgB2M) {
	log.silly("balancer message: " + JSON.stringify(message));
	if (message.type === "join") {
		const msg = message.payload;
		const client = new BalancerClient(msg.room, msg.client, conn);
		connections.push(client);
		client.on("auth", onClientAuth);
		client.on("message", onClientMessage);
		client.on("disconnect", onClientDisconnect);
		client.auth(msg.token);
	} else if (message.type === "leave") {
		const msg = message.payload;
		const client = connections.find(c => c.id === msg.client);
		if (client instanceof BalancerClient) {
			client.leave();
		} else {
			log.error(
				`Balancer tried to make client leave that does not exist or is not a balancer client`
			);
		}
	} else if (message.type === "client_msg") {
		const msg = message.payload;
		const client = connections.find(c => c.id === msg.client_id);
		if (client instanceof BalancerClient) {
			client.receiveMessage(msg.payload as ClientMessage);
		} else {
			log.error(
				`Balancer sent message for client that does not exist or is not a balancer client`
			);
		}
	} else {
		log.error(`Unknown balancer message type: ${(message as { type: string }).type}`);
	}
}

function onBalancerError(conn: BalancerConnection, error: WebSocket.ErrorEvent) {
	log.error(`Error from balancer ${conn.id}: ${error}`);
}

async function makeRoomRequest(client: Client, request: RoomRequest): Promise<void> {
	if (!client.token) {
		throw new Error("No token present");
	}
	const result = await roommanager.getRoom(client.room, {
		mustAlreadyBeLoaded: true,
	});
	if (!result.ok) {
		log.error(`Failed to get room ${client.room} when processing request`);
		return;
	}
	const room = result.value;
	await room.processUnauthorizedRequest(request, {
		token: client.token,
	});
}

async function broadcast(roomName: string, msg: ServerMessage) {
	const clients = roomJoins.get(roomName);
	if (!clients) {
		return;
	}
	const text = JSON.stringify(msg, replacer);
	const balancers = new Set<string>();
	for (const client of clients) {
		if (client instanceof BalancerClient) {
			balancers.add(client.conn.id);
		} else {
			try {
				client.sendRaw(text);
			} catch (e) {
				if (e instanceof Error) {
					log.error(`failed to send to client: ${e.message}`);
				} else {
					log.error(`failed to send to client`);
				}
			}
		}
	}

	// broadcast to balancers
	for (const balancerId of balancers) {
		const conn = balancerManager.getConnection(balancerId);
		if (!conn) {
			log.error(`Balancer ${balancerId} not found`);
			continue;
		}
		conn.send({
			type: "room_msg",
			payload: {
				room: roomName,
				payload: msg,
			},
		});
	}
}

async function onRoomPublish(roomName: string, msg: ServerMessage) {
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

		await broadcast(roomName, msg);
	} else if (msg.action === "chat") {
		await broadcast(roomName, msg);
	} else if (msg.action === "event" || msg.action === "eventcustom") {
		await broadcast(roomName, msg);
	} else if (msg.action === "user") {
		const clients = roomJoins.get(roomName);
		if (!clients) {
			return;
		}
		for (const client of clients) {
			if (msg.user.id === client.id) {
				msg.user.isYou = true;
				client.send(msg);
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
			client.kick(OttWebsocketError.ROOM_UNLOADED);
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
				client.sendRaw(text);
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
			await makeRoomRequest(client, {
				type: RoomRequestType.UpdateUser,
				info: client.getClientInfo(),
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
		if (client instanceof DirectClient) {
			client.ping();
		}
	}
}, 10000);

const gaugeWebsocketConnections = new Gauge({
	name: "ott_websocket_connections",
	help: "The number of active websocket connections (deprecated)",
	collect() {
		this.set(connections.length);
	},
});

const gaugeClients = new Gauge({
	name: "ott_clients_connected",
	help: "The number of clients connected.",
	labelNames: ["clientType", "joinStatus"],
	collect() {
		this.reset();
		for (const client of connections) {
			const clientType = client instanceof DirectClient ? "direct" : "balancer";
			this.labels(clientType, ClientJoinStatus[client.joinStatus]).inc();
		}
	},
});

export default {
	setup,
	onUserModified,
	getClient,
	makeRoomRequest,
};
