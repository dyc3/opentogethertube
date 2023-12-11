import { v4 as uuidv4 } from "uuid";
import EventEmitter from "events";
import WebSocket from "ws";

import { getLogger } from "./logger";
import { conf } from "./ott-config";
import { Result, err, ok, intoResult } from "../common/result";
import { AuthToken, ClientId } from "../common/models/types";
import { replacer } from "../common/serialize";
import { OttWebsocketError } from "ott-common/models/types";
import roommanager from "./roommanager";
import type { RoomListItem } from "./api/room";
import _ from "lodash";
import type { MsgB2M, MsgM2B } from "./generated";
export type { MsgB2M, MsgM2B };

const log = getLogger("balancer");

export let wss: WebSocket.Server | null = null;

export function initBalancerConnections() {
	const enabled = conf.get("balancing.enabled");
	if (!enabled) {
		log.warn("Load balancing is disabled");
		return;
	}

	roommanager.on("load", onRoomLoad);
	roommanager.on("unload", onRoomUnload);

	gossipDebounced();

	wss = new WebSocket.Server({
		port: conf.get("balancing.port"),
	});
	wss.on("connection", ws => {
		log.debug("New balancer connection");
		const conn = new BalancerConnectionReal(ws);
		balancerManager.addBalancerConnection(conn);
	});
	wss.on("error", error => {
		log.error(`Balancer websocket error: ${error}`);
	});
	wss.on("listening", () => {
		log.info(
			`Load balancing is enabled. Listening for balancers on port ${conf.get(
				"balancing.port"
			)}`
		);
	});
}

class BalancerManager {
	balancerConnections: BalancerConnection[] = [];
	bus = new EventEmitter();

	addBalancerConnection(conn: BalancerConnection) {
		this.balancerConnections.push(conn);
		this.onBalancerConnect(conn);
		conn.on("connect", () => this.onBalancerConnect(conn));
		conn.on("disconnect", (code, reason) => this.onBalancerDisconnect(conn, code, reason));
		conn.on("message", msg => this.onBalancerMessage(conn, msg));
		conn.on("error", error => this.onBalancerError(conn, error));
	}

	getConnection(id: string): BalancerConnection | undefined {
		return this.balancerConnections.find(conn => conn.id === id);
	}

	private onBalancerConnect(conn: BalancerConnection) {
		log.info(`Connected to balancer ${conn.id}`);
		this.emit("connect", conn);

		const init: MsgM2B = {
			type: "init",
			payload: {
				port: conf.get("port"),
				region: conf.get("balancing.region"),
			},
		};
		conn.send(init);
	}

	private onBalancerDisconnect(conn: BalancerConnection, code: number, reason: string) {
		log.debug(`Disconnected from balancer ${conn.id}: ${code} ${reason}`);
		this.emit("disconnect", conn);
		for (const conn of this.balancerConnections) {
			if (conn.id === conn.id) {
				this.balancerConnections.splice(this.balancerConnections.indexOf(conn), 1);
				break;
			}
		}
	}

	private onBalancerMessage(conn: BalancerConnection, message: MsgB2M) {
		this.emit("message", conn, message);
	}

	private onBalancerError(conn: BalancerConnection, error: WebSocket.ErrorEvent) {
		log.error(`Error from balancer ${conn.id}: ${error}`);
		this.emit("error", conn, error);
	}

	on<E extends BalancerManagerEvemts>(event: E, handler: BalancerManagerEventHandlers<E>) {
		this.bus.on(event, handler);
	}

	private emit<E extends BalancerManagerEvemts>(
		event: E,
		...args: Parameters<BalancerManagerEventHandlers<E>>
	) {
		this.bus.emit(event, ...args);
	}
}

export const balancerManager = new BalancerManager();

export type BalancerManagerEvemts = BalancerConnectionEvents;
export type BalancerManagerEventHandlers<E> = E extends "connect"
	? (conn: BalancerConnection) => void
	: E extends "disconnect"
	? (conn: BalancerConnection) => void
	: E extends "message"
	? (conn: BalancerConnection, message: MsgB2M) => void
	: E extends "error"
	? (conn: BalancerConnection, error: WebSocket.ErrorEvent) => void
	: never;

export type BalancerConnectionEvents = "connect" | "disconnect" | "message" | "error";
export type BalancerConnectionEventHandlers<E> = E extends "connect"
	? () => void
	: E extends "disconnect"
	? (code: number, reason: string) => void
	: E extends "message"
	? (message: MsgB2M) => void
	: E extends "error"
	? (error: WebSocket.ErrorEvent) => void
	: never;

export abstract class BalancerConnection {
	/** A local identifier for the balancer. Other monoliths will have different IDs for the same balancer. */
	id: string;
	protected bus: EventEmitter = new EventEmitter();

	constructor() {
		this.id = uuidv4();
	}

	protected emit<E extends BalancerConnectionEvents>(
		event: E,
		...args: Parameters<BalancerConnectionEventHandlers<E>>
	) {
		this.bus.emit(event, ...args);
	}

	on<E extends BalancerConnectionEvents>(event: E, handler: BalancerConnectionEventHandlers<E>) {
		this.bus.on(event, handler);
	}

	abstract send(message: MsgM2B): Result<void, Error>;
}

/** Manages the websocket connection to a Balancer. */
export class BalancerConnectionReal extends BalancerConnection {
	private socket: WebSocket;

	constructor(socket: WebSocket) {
		super();
		this.socket = socket;

		this.socket.on("open", this.onSocketConnect.bind(this));
		this.socket.on("close", this.onSocketDisconnect.bind(this));
		this.socket.on("message", this.onSocketMessage.bind(this));
		this.socket.on("error", this.onSocketError.bind(this));
	}

	get readyState(): number {
		if (this.socket === null) {
			return WebSocket.CLOSED;
		}
		return this.socket.readyState;
	}

	disconnect(): Result<void, Error> {
		this.socket.close();
		return ok(undefined);
	}

	private onSocketConnect(event: WebSocket.OpenEvent) {
		const init: MsgM2B = {
			type: "init",
			payload: {
				port: conf.get("port"),
				region: conf.get("balancing.region"),
			},
		};
		this.send(init);
		this.emit("connect");
	}

	private onSocketDisconnect(code: number, reason: string) {
		this.emit("disconnect", code, reason);
	}

	private onSocketMessage(data: WebSocket.Data) {
		let result = intoResult(() => JSON.parse(data.toString()));
		if (result.ok) {
			if (!validateB2M(result.value)) {
				log.error(
					`Error validating incoming balancer message: ${JSON.stringify(result.value)}`
				);
				return;
			}
			this.emit("message", result.value);
		} else {
			log.error(`Error parsing incoming balancer message: ${result.value} - ${data}`);
		}
	}

	private onSocketError(event: WebSocket.ErrorEvent) {
		this.emit("error", event);
	}

	send(message: MsgM2B): Result<void, Error> {
		if (this.socket === null) {
			return err(new Error("Not connected"));
		}
		try {
			this.socket.send(JSON.stringify(message, replacer));
		} catch (e) {
			return err(e);
		}
		return ok(undefined);
	}
}

function validateB2M(message: unknown): message is MsgB2M {
	if (typeof message !== "object" || message === null) {
		return false;
	}
	const msg = message as MsgB2M;
	if (typeof msg.type !== "string") {
		return false;
	}
	if (typeof msg.payload !== "object") {
		return false;
	}
	switch (msg.type) {
		case "join":
			return typeof msg.payload.room === "string" && typeof msg.payload.client === "string";
		case "leave":
			return typeof msg.payload.client === "string";
		case "client_msg":
			return (
				typeof msg.payload.client_id === "string" && typeof msg.payload.payload === "object"
			);
		case "load":
			return typeof msg.payload.room === "string";
		case "unload":
			return typeof msg.payload.room === "string";
		default:
			return false;
	}
}

function broadcastToBalancers(message: MsgM2B) {
	for (const conn of balancerManager.balancerConnections) {
		conn.send(message);
	}
}

async function onRoomLoad(roomName: string) {
	const result = await roommanager.getRoom(roomName, { mustAlreadyBeLoaded: true });
	if (!result.ok) {
		log.error(
			`Failed to grab room that should have been loaded. Can't inform balancers. room=${roomName}: ${result.value}`
		);
		return;
	}
	const room = result.value;
	const obj: GossipRoom = {
		name: room.name,
		title: room.title,
		description: room.description,
		isTemporary: room.isTemporary,
		visibility: room.visibility,
		queueMode: room.queueMode,
		currentSource: room.currentSource,
		users: room.users.length,
	};

	broadcastToBalancers({
		type: "loaded",
		payload: {
			room: obj,
			load_epoch: room.loadEpoch,
		},
	});
	gossipDebounced();
}

function onRoomUnload(roomName: string) {
	broadcastToBalancers({
		type: "unloaded",
		payload: {
			name: roomName,
		},
	});
	gossipDebounced();
}

function gossip() {
	log.debug("Gossiping");
	broadcastToBalancers({
		type: "gossip",
		payload: {
			rooms: roommanager.rooms.map(room => ({
				room: {
					name: room.name,
					title: room.title,
					description: room.description,
					isTemporary: room.isTemporary,
					visibility: room.visibility,
					queueMode: room.queueMode,
					currentSource: room.currentSource,
					users: room.users.length,
				},
				load_epoch: room.loadEpoch,
			})),
		},
	});
	gossipDebounced();
}

const gossipDebounced = _.debounce(gossip, 1000 * 20, { trailing: true, maxWait: 1000 * 20 });

interface GossipRoom extends RoomListItem {}
