import express from "express";
import WebSocket from "ws";
import _ from "lodash";
import { wss } from "./websockets";
import { getLogger } from "./logger";
import { Request } from "express";
import { createSubscriber, redisClient } from "./redisclient";
import {
	ClientMessage,
	RoomRequest,
	RoomRequestType,
	ServerMessage,
	ServerMessageSync,
	ServerMessageUser,
	ServerMessageYou,
} from "../common/models/messages";
import { ClientNotFoundInRoomException, MissingToken } from "./exceptions";
import { MySession, OttWebsocketError, AuthToken, ClientId } from "../common/models/types";
import roommanager from "./roommanager";
import { ANNOUNCEMENT_CHANNEL } from "../common/constants";
import tokens, { SessionInfo } from "./auth/tokens";
import { RoomStateSyncable } from "./room";
import { Gauge } from "prom-client";
import { replacer } from "../common/serialize";
import { Client, ClientJoinStatus, DirectClient, BalancerClient } from "./client";
import { BalancerConnection, MsgB2M, balancerManager, initBalancerConnections } from "./balancer";
import usermanager from "./usermanager";
import { OttException } from "../common/exceptions";
import { conf } from "./ott-config";

const log = getLogger("clientmanager");

const connections: Client[] = [];
const roomJoins: Map<string, Client[]> = new Map();
export async function setup(): Promise<void> {
	log.debug("setting up client manager...");
	const server = wss;
	server.on("connection", async (ws, req: Request & { session: MySession }) => {
		if (!req.url.startsWith(`${conf.get("base_url")}/api/room/`)) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		await onDirectConnect(ws, req);
	});
	roommanager.on("publish", onRoomPublish);
	roommanager.on("unload", onRoomUnload);
	roommanager.on("command", handleCommand);

	usermanager.on("userModified", onUserModified);

	balancerManager.on("connect", onBalancerConnect);
	balancerManager.on("disconnect", onBalancerDisconnect);
	balancerManager.on("message", onBalancerMessage);
	balancerManager.on("error", onBalancerError);
	initBalancerConnections();

	if (conf.get("env") !== "test") {
		log.silly("creating redis subscriber");
		const redisSubscriber = await createSubscriber();
		log.silly("subscribing to announcement channel");
		await redisSubscriber.subscribe(ANNOUNCEMENT_CHANNEL, onAnnouncement);
	}
}

export function shutdown() {
	log.info("Shutting down client manager");
	for (const client of connections) {
		client.kick(OttWebsocketError.AWAY);
	}
}

/**
 * Called when a websocket connects.
 * @param socket
 */
async function onDirectConnect(socket: WebSocket, req: express.Request) {
	const roomName = req.url.split("/").slice(-1)[0];
	log.debug(`connection received: ${roomName}, waiting for auth token...`);
	const client = new DirectClient(roomName, socket);
	addClient(client);
}

export function addClient(client: Client) {
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
	const syncMsg = Object.assign(
		{ action: "sync" },
		room.syncableState()
	) as unknown as ServerMessageSync;
	client.send(syncMsg);

	// join the room
	let clients = roomJoins.get(room.name);
	if (clients === undefined) {
		log.warn("room joins not present, creating");
		clients = [];
		roomJoins.set(room.name, clients);
	}
	clients.push(client);

	// actually join the room
	try {
		await makeRoomRequest(client, {
			type: RoomRequestType.JoinRequest,
			info: client.getClientInfo(),
		});
	} catch (e) {
		log.error(`Failed to process join request for client ${client.id}: ${e}`);
	}

	// initialize client info
	const clientsInit: ServerMessageUser = {
		action: "user",
		update: {
			kind: "init",
			value: room.users,
		},
	};
	client.send(clientsInit);

	const youmsg: ServerMessageYou = {
		action: "you",
		info: {
			id: client.id,
		},
	};
	client.send(youmsg);
}

async function onClientMessage(client: Client, msg: ClientMessage) {
	try {
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
	} catch (err) {
		log.error(
			`Failed to process client (id=${client.id}, room=${client.room}) message (action=${msg.action}): ${err}`
		);
		if (err instanceof OttException) {
			if (err instanceof MissingToken) {
				log.error("Client is missing token, kicking client");
				client.kick(OttWebsocketError.MISSING_TOKEN);
			}
		} else {
			log.error("Unknown error type, kicking client");
			client.kick(OttWebsocketError.UNKNOWN);
		}
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

	if (client.joinStatus !== ClientJoinStatus.Joined) {
		log.debug(`Client ${client.id} disconnected before joining`);
		return;
	}

	const result = await roommanager.getRoom(client.room, { mustAlreadyBeLoaded: true });
	if (!result.ok) {
		log.error(
			`Failed to get room ${client.room} when processing disconnect: ${result.value.name}: ${result.value.message}`
		);
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

	await broadcast(room.name, {
		action: "user",
		update: {
			kind: "remove",
			value: client.id,
		},
	});
}

function onBalancerConnect(conn: BalancerConnection) {
	log.info(`Connected to balancer ${conn.id}`);
}

function onBalancerDisconnect(conn: BalancerConnection) {
	log.info(`Disconnected from balancer ${conn.id}`);
	// We can't immediately remove the balancer clients from the connections array because that would mess up the index of the other clients, so we have to do it later
	const leavingClients: BalancerClient[] = [];
	for (const client of connections) {
		if (client instanceof BalancerClient && client.conn.id === conn.id) {
			log.debug(`Kicking balancer client ${client.id}`);
			leavingClients.push(client);
		}
	}
	for (const client of leavingClients) {
		client.leave();
	}
}

async function onBalancerMessage(conn: BalancerConnection, message: MsgB2M) {
	log.silly("balancer message: " + JSON.stringify(message));

	/**
	 * This is a type that maps the message type to the handler for that message type.
	 *
	 * Useful for handling enums that are discriminated by a string, like the ones generated by typeshare.
	 */
	type EnumHandler<T extends { type: string; payload: T["payload"] }> = {
		[P in T["type"]]: (
			instruction: Extract<T, { type: P; payload: T["payload"] }>
		) => Promise<void>;
	};

	// the intersection type makes it so that it throws a compile error if all the enum variants aren't handled
	const handlers: Record<MsgB2M["type"], unknown> & EnumHandler<MsgB2M> = {
		load: async message => {
			const msg = message.payload;
			await roommanager.getRoom(msg.room);
		},
		unload: async message => {
			const msg = message.payload;
			await roommanager.unloadRoom(msg.room);
		},
		join: async message => {
			const msg = message.payload;
			const client = new BalancerClient(msg.room, msg.client, conn);
			connections.push(client);
			client.on("auth", onClientAuth);
			client.on("message", onClientMessage);
			client.on("disconnect", onClientDisconnect);
			client.auth(msg.token);
		},
		leave: async message => {
			const msg = message.payload;
			const client = connections.find(c => c.id === msg.client);
			if (client instanceof BalancerClient) {
				client.leave();
			} else {
				log.error(
					`Balancer tried to make client leave that does not exist or is not a balancer client`
				);
			}
		},
		client_msg: async message => {
			const msg = message.payload;
			const client = connections.find(c => c.id === msg.client_id);
			if (client instanceof BalancerClient) {
				client.receiveMessage(msg.payload as ClientMessage);
			} else {
				log.error(
					`Balancer sent message for client that does not exist or is not a balancer client`
				);
			}
		},
	};

	const handler = handlers[message.type];
	if (!handler) {
		log.error(`Unknown balancer message type: ${(message as { type: string }).type}`);
		return;
	}
	await handler(message as any); // this cast is safe because the type is checked and narrowed above
}

function onBalancerError(conn: BalancerConnection, error: WebSocket.ErrorEvent) {
	log.error(`Error from balancer ${conn.id}: ${error}`);
}

async function makeRoomRequest(client: Client, request: RoomRequest): Promise<void> {
	if (!client.token) {
		throw new MissingToken();
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
		clientId: client.id,
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
	await broadcast(roomName, msg);
}

async function handleCommand(roomName: string, command: ClientManagerCommand) {
	if (command.type === "kick") {
		const client = getClient(command.clientId);
		client?.kick(OttWebsocketError.KICKED);
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
}

function onAnnouncement(text: string) {
	log.debug(`Announcement: ${text}`);
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
}

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

function getClientByToken(token: AuthToken, roomName: string): Client {
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

function getClient(id: ClientId): Client | undefined {
	for (const client of connections) {
		if (client.id === id) {
			return client;
		}
	}
	return undefined;
}

function getClientsInRoom(roomName: string): Client[] {
	return roomJoins.get(roomName) ?? [];
}

setInterval(() => {
	for (const client of connections) {
		if (client instanceof DirectClient) {
			client.ping();
		}
	}
}, 10000);

export type ClientManagerCommand = CmdKick;

interface CmdBase {
	type: string;
}

export interface CmdKick extends CmdBase {
	type: "kick";
	clientId: ClientId;
}

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
	shutdown,
	onUserModified,
	getClientByToken,
	makeRoomRequest,
	addClient,
	getClient,
	getClientsInRoom,
};
