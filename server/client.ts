import type { AuthToken, ClientId } from "ott-common/models/types";
import type { ClientMessage } from "ott-common/models/messages";
import WebSocket from "ws";
import { SessionInfo, setSessionInfo } from "./auth/tokens";
import uuid from "uuid";
import EventEmitter from "events";
import { getLogger } from "./logger";
import { getSessionInfo } from "./auth/tokens";

const log = getLogger("client");

export type ClientEvents = "auth" | "message" | "disconnect";
export type ClientEventHandlers<E> = E extends "auth"
	? (token: AuthToken, session: SessionInfo) => void
	: E extends "message"
	? (msg: ClientMessage) => void
	: E extends "disconnect"
	? () => void
	: never;

export enum ClientJoinStatus {
	WaitingForAuth,
	Joined,
}

/**
 * A client that is connected to the server.
 */
export class Client {
	id: ClientId;
	room: string;
	token: AuthToken | null = null;
	session?: SessionInfo;
	joinStatus: ClientJoinStatus = ClientJoinStatus.WaitingForAuth;

	private bus: EventEmitter;

	constructor(room: string) {
		this.id = uuid.v4();
		this.room = room;
		this.bus = new EventEmitter();
	}

	on<E extends ClientEvents>(event: E, handler: ClientEventHandlers<E>) {
		this.bus.on(event, handler);
	}

	emit<E extends ClientEvents>(event: E, ...args: Parameters<ClientEventHandlers<E>>) {
		this.bus.emit(event, ...args);
	}

	async saveSession(): Promise<void> {
		if (!this.token) {
			throw new Error("Client has not authenticated yet");
		}
		if (!this.session) {
			throw new Error("Client has no session");
		}
		await setSessionInfo(this.token, this.session);
	}

	async auth(token: AuthToken): Promise<void> {
		this.token = token;
		this.session = await getSessionInfo(this.token);
		this.emit("auth", this.token, this.session);
	}
}

/**
 * A client that is connected directly to the server.
 */
export class DirectClient extends Client {
	socket: WebSocket;
	constructor(room: string, socket: WebSocket) {
		super(room);
		this.socket = socket;

		this.socket.on("message", this.onData);
		this.socket.on("ping", this.onPing);
		this.socket.on("close", this.onClose);
		this.socket.on("error", this.onError);
	}

	onData(data: WebSocket.Data) {
		const msg: ClientMessage = JSON.parse(data.toString());
		if (msg.action === "auth") {
			this.auth(msg.token);
		}
		this.emit("message", msg);
	}

	onPing() {
		this.socket.pong();
	}

	onClose() {
		this.emit("disconnect");
	}

	onError(err: Error) {
		log.error(`Error on socket for client ${this.id}: ${err}`);
	}
}

/**
 * A client that is connected from a load balancer.
 */
export class BalancerClient extends Client {
	constructor(room: string) {
		super(room);
		// The balancer takes care of waiting for auth.
		this.joinStatus = ClientJoinStatus.Joined;
	}
}
