import { v4 as uuidv4 } from "uuid";
import EventEmitter from "events";
import { URL } from "url";
import WebSocket from "ws";

import { getLogger } from "./logger";
import { BalancerConfig, conf } from "./ott-config";
import { Result, err, ok, intoResult } from "../common/result";
import { AuthToken, ClientId } from "../common/models/types";
import { replacer } from "../common/serialize";
import { OttWebsocketError } from "ott-common/models/types";

const log = getLogger("balancer");

export function initBalancerConnections() {
	const configs = conf.get("balancers");
	if (configs.length === 0) {
		log.warn("No balancers configured");
		return;
	}
	log.info("Initializing balancer connections...");
	for (const config of configs) {
		const conn = new BalancerConnection(config);
		balancerManager.addBalancerConnection(conn);
	}
}

class BalancerManager {
	balancerConnections: BalancerConnection[] = [];
	bus = new EventEmitter();

	addBalancerConnection(conn: BalancerConnection) {
		this.balancerConnections.push(conn);
		conn.on("connect", () => this.onBalancerConnect(conn));
		conn.on("disconnect", () => this.onBalancerDisconnect(conn));
		conn.on("message", msg => this.onBalancerMessage(conn, msg));
		conn.on("error", error => this.onBalancerError(conn, error));
		const result = conn.connect();
		if (!result.ok) {
			log.error(`Error connecting to balancer ${conn.id}: ${result.value}`);
		}
	}

	getConnection(id: string): BalancerConnection | undefined {
		return this.balancerConnections.find(conn => conn.id === id);
	}

	private onBalancerConnect(conn: BalancerConnection) {
		log.info(`Connected to balancer ${conn.id}`);
		this.emit("connect", conn);
	}

	private onBalancerDisconnect(conn: BalancerConnection) {
		log.info(`Disconnected from balancer ${conn.id}`);
		this.emit("disconnect", conn);

		if (!conn.reconnecting) {
			log.info(`Reconnecting to balancer ${conn.id}`);
			conn.reconnect();
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

type BalancerManagerEvemts = BalancerConnectionEvents;
type BalancerManagerEventHandlers<E> = E extends "connect"
	? (conn: BalancerConnection) => void
	: E extends "disconnect"
	? (conn: BalancerConnection) => void
	: E extends "message"
	? (conn: BalancerConnection, message: MsgB2M) => void
	: E extends "error"
	? (conn: BalancerConnection, error: WebSocket.ErrorEvent) => void
	: never;

type BalancerConnectionEvents = "connect" | "disconnect" | "message" | "error";
type BalancerConnectionEventHandlers<E> = E extends "connect"
	? () => void
	: E extends "disconnect"
	? () => void
	: E extends "message"
	? (message: MsgB2M) => void
	: E extends "error"
	? (error: WebSocket.ErrorEvent) => void
	: never;

/** Manages the websocket connection to a Balancer. */
export class BalancerConnection {
	/** A local identifier for the balancer. Other monoliths will have different IDs for the same balancer. */
	id: string;
	config: BalancerConfig;
	private socket: WebSocket | null = null;
	private bus: EventEmitter = new EventEmitter();
	reconnecting = false;
	private reconnectAttempts = 0;
	private reconnectTimeout: NodeJS.Timeout | null = null;

	constructor(config: BalancerConfig) {
		this.id = uuidv4();
		this.config = config;
	}

	get socketUrl(): URL {
		return new URL(`ws://${this.config.host}:${this.config.port}/monolith`);
	}

	get readyState(): number {
		if (this.socket === null) {
			return WebSocket.CLOSED;
		}
		return this.socket.readyState;
	}

	get reconnectDelay(): number {
		return Math.min(1000 * 2 ** this.reconnectAttempts, 1000 * 60);
	}

	connect(): Result<void, Error> {
		if (this.socket !== null) {
			return err(new Error("Already connected"));
		}
		this.socket = new WebSocket(this.socketUrl);
		this.socket.on("open", this.onSocketConnect.bind(this));
		this.socket.on("close", this.onSocketDisconnect.bind(this));
		this.socket.on("message", this.onSocketMessage.bind(this));
		this.socket.on("error", this.onSocketError.bind(this));
		return ok(undefined);
	}

	/** Attempt to reconnect until successful */
	reconnect(): Result<void, Error> {
		if (this.socket !== null) {
			this.socket.close();
		}
		this.reconnecting = true;
		this.reconnectAttempts++;
		if (this.reconnectTimeout !== null) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		return this.connect();
	}

	disconnect(): Result<void, Error> {
		if (this.reconnecting) {
			this.reconnecting = false;
			this.reconnectAttempts = 0;
			if (this.reconnectTimeout !== null) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}
		}
		if (this.socket === null) {
			return err(new Error("Not connected"));
		}
		this.socket.close();
		this.socket = null;
		return ok(undefined);
	}

	private onSocketConnect(event: WebSocket.OpenEvent) {
		this.reconnecting = false;
		this.reconnectAttempts = 0;
		this.reconnectTimeout = null;
		this.emit("connect");
	}

	private onSocketDisconnect(event: WebSocket.CloseEvent) {
		this.socket = null;
		this.emit("disconnect");
		if (this.reconnecting) {
			log.info(
				`Reconnecting to balancer ${this.id} in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}))`
			);
			this.reconnectTimeout = setTimeout(() => {
				let result = this.reconnect();
				log.info(`Reconnect result: ${result.ok ? "success" : result.value}`);
			}, this.reconnectDelay);
		}
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

	private emit<E extends BalancerConnectionEvents>(
		event: E,
		...args: Parameters<BalancerConnectionEventHandlers<E>>
	) {
		this.bus.emit(event, ...args);
	}

	on<E extends BalancerConnectionEvents>(event: E, handler: BalancerConnectionEventHandlers<E>) {
		this.bus.on(event, handler);
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
		default:
			return false;
	}
}

// TODO: use typeshare?
export type MsgB2M = MsgB2MJoin | MsgB2MLeave | MsgB2MClientMsg<unknown>;

interface MsgB2MJoin {
	type: "join";
	payload: {
		room: string;
		client: ClientId;
		token: AuthToken;
	};
}

interface MsgB2MLeave {
	type: "leave";
	payload: {
		client: ClientId;
	};
}

interface MsgB2MClientMsg<T> {
	type: "client_msg";
	payload: {
		client_id: ClientId;
		payload: T;
	};
}

export type MsgM2B =
	| MsgM2BLoaded
	| MsgM2BUnloaded
	| MsgM2BGossip
	| MsgM2BRoomMsg<unknown>
	| MsgM2BKick;

interface MsgM2BLoaded {
	type: "loaded";
	payload: {
		room: string;
	};
}

interface MsgM2BUnloaded {
	type: "unloaded";
	payload: {
		room: string;
	};
}

interface MsgM2BGossip {
	type: "gossip";
	payload: {
		rooms: string[];
	};
}

interface MsgM2BRoomMsg<T> {
	type: "room_msg";
	payload: {
		room: string;
		client_id?: ClientId;
		payload: T;
	};
}

interface MsgM2BKick {
	type: "kick";
	payload: {
		client_id: ClientId;
		reason: OttWebsocketError;
	};
}
