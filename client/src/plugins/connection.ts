import { inject, InjectionKey, App, Plugin, ref, Ref } from "vue";
import type {
	ClientMessage,
	ClientMessageAuthenticate,
	ServerMessage,
	ServerMessageActionType,
} from "ott-common/models/messages";
import type { AuthToken, OttWebsocketError } from "ott-common/models/types";

export interface OttRoomConnection {
	active: Ref<boolean>;
	connected: Ref<boolean>;
	kickReason: Ref<OttWebsocketError | null>;

	connect(roomName: string): void;
	reconnect(): void;
	disconnect(): void;
	send(message: ClientMessage): void;
	addMessageHandler(action: ServerMessageActionType, handler: (msg: ServerMessage) => void): void;
	removeMessageHandler(
		action: ServerMessageActionType,
		handler: (msg: ServerMessage) => void
	): void;
	clearAllMessageHandlers(): void;
}

export const connectionInjectKey: InjectionKey<OttRoomConnection> = Symbol("ott:connection");

export function useConnection(): OttRoomConnection {
	const connection = inject(connectionInjectKey);
	if (!connection) {
		throw new Error("No connection available, did you forget to install the plugin?");
	}
	return connection;
}

type ConnectionEventKind = "connected" | "disconnected" | "kicked";

export type ConnectionEvent =
	| ConnectionEventConnected
	| ConnectionEventDisconnected
	| ConnectionEventKicked;

export interface ConnectionEventConnected {
	kind: "connected";
}

export interface ConnectionEventDisconnected {
	kind: "disconnected";
}

export interface ConnectionEventKicked {
	kind: "kicked";
	reason: OttWebsocketError;
}

class OttRoomConnectionReal implements OttRoomConnection {
	/**
	 * Indicates if the client is actively attempting to maintain a connection. Not an indication of whether the connection is connected, see `connected`.
	 * @returns true if the client is actively attempting to maintain a connection to a room.
	 */
	active = ref(false);
	reconnecting = ref(false);
	connected = ref(false);
	roomName = ref("");
	reconnectAttempts = ref(0);
	reconnectDelay = 1000;
	reconnectDelayIncrease = 1000;
	kickReason: Ref<OttWebsocketError | null> = ref(null);

	private socket: WebSocket | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private messageHandlers = new Map<ServerMessageActionType, ((msg: ServerMessage) => void)[]>();
	private eventHandlers = new Map<ConnectionEventKind, ((e: unknown) => void)[]>();

	constructor() {}

	get connectionUrl() {
		return `${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${
			window.location.host
		}/api/room/${this.roomName.value}`;
	}

	connect(roomName: string) {
		if (this.active.value) {
			console.log("connect(): connection is already active, ignoring");
			return;
		}
		this.roomName.value = roomName;
		this.active.value = true;
		this.kickReason.value = null;
		this.doConnect();
	}

	reconnect() {
		if (!this.active.value) {
			console.log("reconnect(): connection is not active, ignoring");
			return;
		}
		console.log("reconnecting...");
		this.reconnectAttempts.value += 1;
		this.doConnect();
	}

	private doConnect() {
		let url = this.connectionUrl;
		this.socket = new WebSocket(url);
		console.debug(`connecting to ${url}`);
		this.socket.addEventListener("open", () => this.onOpen());
		this.socket.addEventListener("close", e => this.onClose(e));
		this.socket.addEventListener("message", e => this.onMessage(e));
		this.socket.addEventListener("error", e => this.onError(e));
	}

	send(message: ClientMessage) {
		if (!this.active.value) {
			throw new Error("send(): connection is not active");
		}
		if (!this.connected.value) {
			throw new Error("send(): connection is not connected");
		}
		let text = JSON.stringify(message);
		this.socket!.send(text);
	}

	disconnect() {
		if (!this.active.value) {
			console.log("disconnect(): connection is not active, ignoring");
			return;
		}
		this.socket!.close();
		this.socket = null;
		if (this.reconnecting && this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.roomName.value = "";
		this.active.value = false;
	}

	private onOpen() {
		this.connected.value = true;
		this.reconnecting.value = false;
		this.reconnectAttempts.value = 0;
		console.info("socket open");
		let authMsg: ClientMessageAuthenticate = {
			action: "auth",
			token: window.localStorage.getItem("token") as AuthToken,
		};
		this.send(authMsg);
	}

	private onClose(e: { code: number }) {
		console.info("socket closed", e);
		this.connected.value = false;
		this.socket = null;
		this.dispatchEvent({ kind: "disconnected" });
		if (e.code >= 4000) {
			this.kickReason.value = e.code;
			this.dispatchEvent({ kind: "kicked", reason: e.code });
			this.active.value = false;
		} else if (this.active.value) {
			this.reconnecting.value = true;
			this.reconnectTimeout = setTimeout(
				() => this.reconnect(),
				this.reconnectDelay + this.reconnectDelayIncrease * this.reconnectAttempts.value
			);
		}
	}

	private onMessage(e: { data: string | unknown }) {
		console.debug("socket message", e);
		if (typeof e.data === "string") {
			try {
				let msg = JSON.parse(e.data) as ServerMessage;
				this.handleMessage(msg);
				// this.store.dispatch(msg.action, msg);
			} catch (e) {
				console.error("unable to process message: ", e.data, e);
			}
		}
	}

	private onError(e: unknown) {
		console.log("socket error", e);
	}

	addMessageHandler(action: ServerMessageActionType, handler: (msg: ServerMessage) => void) {
		let handlers = this.messageHandlers.get(action) ?? [];
		handlers.push(handler);
		this.messageHandlers.set(action, handlers);
	}

	removeMessageHandler(action: ServerMessageActionType, handler: (msg: ServerMessage) => void) {
		let handlers = this.messageHandlers.get(action) ?? [];
		let index = handlers.indexOf(handler);
		if (index >= 0) {
			handlers.splice(index, 1);
			this.messageHandlers.set(action, handlers);
		}
	}

	clearAllMessageHandlers(): void {
		this.messageHandlers.clear();
	}

	private handleMessage(msg: ServerMessage) {
		let handlers = this.messageHandlers.get(msg.action) ?? [];
		if (handlers.length === 0) {
			console.warn("connection: no message handlers for message: ", msg.action);
			return;
		}
		for (let handler of handlers) {
			handler(msg);
		}
	}

	addEventHandler(event: ConnectionEventKind, handler: (e: unknown) => void) {
		let handlers = this.eventHandlers.get(event) ?? [];
		handlers.push(handler);
		this.eventHandlers.set(event, handlers);
	}

	removeEventHandler(event: ConnectionEventKind, handler: (e: unknown) => void) {
		let handlers = this.eventHandlers.get(event) ?? [];
		let index = handlers.indexOf(handler);
		if (index >= 0) {
			handlers.splice(index, 1);
			this.eventHandlers.set(event, handlers);
		}
	}

	dispatchEvent(e: ConnectionEvent) {
		console.info("dispatching event", e);
		let handlers = this.eventHandlers.get(e.kind) ?? [];
		for (let handler of handlers) {
			handler(e);
		}
	}
}

export const OttRoomConnectionPlugin: Plugin = (app: App, options) => {
	const connection = new OttRoomConnectionReal();
	app.provide(connectionInjectKey, connection);
};

export default OttRoomConnectionPlugin;

export class OttRoomConnectionMock implements OttRoomConnection {
	active: Ref<boolean> = ref(false);
	connected: Ref<boolean> = ref(false);
	kickReason: Ref<OttWebsocketError | null> = ref(null);

	sent: ClientMessage[] = [];
	private messageHandlers = new Map<ServerMessageActionType, ((msg: ServerMessage) => void)[]>();

	public mockReset() {
		this.sent = [];
	}

	public mockReceive(msg: ServerMessage) {
		this.handleMessage(msg);
	}

	public connect(roomName: string) {}
	public reconnect() {}
	public disconnect() {}
	public send(message: ClientMessage) {
		this.sent.push(message);
	}

	public addMessageHandler(
		action: ServerMessageActionType,
		handler: (msg: ServerMessage) => void
	) {
		let handlers = this.messageHandlers.get(action) ?? [];
		handlers.push(handler);
		this.messageHandlers.set(action, handlers);
	}

	public removeMessageHandler(
		action: ServerMessageActionType,
		handler: (msg: ServerMessage) => void
	) {
		let handlers = this.messageHandlers.get(action) ?? [];
		let index = handlers.indexOf(handler);
		if (index >= 0) {
			handlers.splice(index, 1);
			this.messageHandlers.set(action, handlers);
		}
	}

	clearAllMessageHandlers(): void {
		this.messageHandlers.clear();
	}

	private handleMessage(msg: ServerMessage) {
		let handlers = this.messageHandlers.get(msg.action) ?? [];
		if (handlers.length === 0) {
			return;
		}
		for (let handler of handlers) {
			handler(msg);
		}
	}
}
