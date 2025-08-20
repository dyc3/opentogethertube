import EventEmitter from "events";
import _ from "lodash";
import type { RoomListItem } from "ott-common/models/rest-api.js";
import { AuthToken, ClientId, OttWebsocketError } from "ott-common/models/types.js";
import { err, intoResult, ok, Result } from "ott-common/result.js";
import { replacer } from "ott-common/serialize.js";
import { Gauge } from "prom-client";
import { v4 as uuidv4 } from "uuid";
import WebSocket from "ws";
import type { MsgB2M, MsgM2B, UnloadReason } from "./generated.js";
import { getLogger } from "./logger.js";
import { conf } from "./ott-config.js";
import roommanager from "./roommanager.js";
export type { MsgB2M, MsgM2B };

const log = getLogger("balancer");

export let wss: WebSocket.Server | null = null;
const monolithId = uuidv4();

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

	async addBalancerConnection(conn: BalancerConnection) {
		this.onBalancerPreconnect(conn);
		conn.on("connect", () => this.onBalancerConnect(conn));
		conn.on("disconnect", (code, reason) => this.onBalancerDisconnect(conn, code, reason));
		conn.on("error", error => this.onBalancerError(conn, error));

		const waitForInit = new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				conn.disconnect(1002, "Balancer did not send init message");
				reject(new Error("Balancer did not send init message"));
			}, 1000 * 10);
			const handler = (msg: MsgB2M) => {
				if (msg.type === "init") {
					conn.id = msg.payload.id;
					conn.off("message", handler);
					conn.off("disconnect", disconnectHandler);
					clearTimeout(timeout);
					resolve();
				}
			};
			const disconnectHandler = () => {
				clearTimeout(timeout);
				reject(new Error("Balancer disconnected before sending init message"));
			};
			conn.on("message", handler);
			conn.on("disconnect", disconnectHandler);
		});

		try {
			log.debug("Waiting for balancer init message");
			await waitForInit;
		} catch (e) {
			log.error(`Balancer did not send init message in time: ${e}`);
			return;
		}

		conn.on("message", msg => this.onBalancerMessage(conn, msg));
		this.onBalancerConnect(conn);
		this.balancerConnections.push(conn);
	}

	getConnection(id: string): BalancerConnection | undefined {
		return this.balancerConnections.find(conn => conn.id === id);
	}

	private onBalancerPreconnect(conn: BalancerConnection) {
		const init: MsgM2B = {
			type: "init",
			payload: {
				port: conf.get("port"),
				region: conf.get("balancing.region"),
				id: monolithId,
			},
		};
		conn.send(init);
	}

	private onBalancerConnect(conn: BalancerConnection) {
		log.info(`Connected to balancer ${conn.id}`);
		this.emit("connect", conn);
	}

	private onBalancerDisconnect(conn: BalancerConnection, code: number, reason: string) {
		log.debug(`Disconnected from balancer ${conn.id}: ${code} ${reason}`);
		this.emit("disconnect", conn);
		const idx = this.balancerConnections.indexOf(conn);
		if (idx === -1) {
			log.error(`Balancer ${conn.id} was not found in balancerConnections`);
			return;
		}
		this.balancerConnections.splice(idx, 1);
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

	off<E extends BalancerManagerEvemts>(event: E, handler: BalancerManagerEventHandlers<E>) {
		this.bus.off(event, handler);
	}

	/**
	 * Used in tests to clear all event listeners.
	 */
	clearListeners() {
		this.bus.removeAllListeners();
	}

	private emit<E extends BalancerManagerEvemts>(
		event: E,
		...args: Parameters<BalancerManagerEventHandlers<E>>
	) {
		this.bus.emit(event, ...args);
	}

	async shutdown(): Promise<void> {
		wss?.removeAllListeners();
		const closePromises = this.balancerConnections.map(conn => {
			return new Promise<void>((resolve, reject) => {
				conn.on("disconnect", () => {
					resolve();
				});
				setTimeout(reject, 1000 * 10, new Error("Balancer did not disconnect in time"));
				let result = conn.disconnect(1001, "Server shutting down");
				if (!result.ok) {
					log.error(`Error disconnecting from balancer ${conn.id}: ${result.value}`);
				}
			});
		});
		try {
			await Promise.all(closePromises);
		} catch (e) {
			log.error(`Error waiting for balancers to disconnect: ${e}`);
		}
		const closePromise = new Promise<void>((resolve, reject) => {
			if (!wss) {
				resolve();
				return;
			}
			// biome-ignore lint/nursery/noShadow: biome migration
			wss.close(err => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
		try {
			await closePromise;
		} catch (e) {
			log.error(`Error shutting down balancing server: ${e}`);
		}
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

	off<E extends BalancerConnectionEvents>(event: E, handler: BalancerConnectionEventHandlers<E>) {
		this.bus.off(event, handler);
	}

	abstract send(message: MsgM2B): Result<void, Error>;

	abstract disconnect(code: number, reason: string): Result<void, Error>;
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

	disconnect(code: number = 1006, reason: string = ""): Result<void, Error> {
		this.socket.close(code, reason);
		return ok(undefined);
	}

	private onSocketConnect(event: WebSocket.OpenEvent) {
		const init: MsgM2B = {
			type: "init",
			payload: {
				port: conf.get("port"),
				region: conf.get("balancing.region"),
				id: monolithId,
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
		case "init":
			return typeof msg.payload.id === "string";
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

function onRoomUnload(roomName: string, reason: UnloadReason) {
	broadcastToBalancers({
		type: "unloaded",
		payload: {
			name: roomName,
			reason,
		},
	});
	gossipDebounced();
}

export function buildGossipMessage(): MsgM2B {
	return {
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
	};
}

function gossip() {
	log.debug("Gossiping");
	broadcastToBalancers(buildGossipMessage());
	gossipDebounced();
}

const gossipDebounced = _.debounce(gossip, 1000 * 20, { trailing: true, maxWait: 1000 * 20 });

interface GossipRoom extends RoomListItem {}

// biome-ignore lint/correctness/noUnusedVariables: biome migration
const gaugeBalancerConnections = new Gauge({
	name: "ott_balancer_connections",
	help: "Number of balancer connections",
	collect() {
		this.set(balancerManager.balancerConnections.length);
	},
});
