import { inject, InjectionKey, App, Plugin, ref, Ref } from "vue";
import type { ClientMessage, ClientMessageAuthenticate, ServerMessage } from "common/models/messages";
import type { AuthToken, OttWebsocketError } from "common/models/types";

const connectionInjectKey: InjectionKey<OttRoomConnection> = Symbol();

export function useConnection(): OttRoomConnection {
	const connection = inject(connectionInjectKey);
	if (!connection) {
		throw new Error("No connection available, did you forget to install the plugin?");
	}
	return connection;
}

type ConnectionEventKind = "connected" | "disconnected" | "kicked";

export type ConnectionEvent = ConnectionEventConnected | ConnectionEventDisconnected | ConnectionEventKicked;

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

class OttRoomConnection {
	active = ref(false);
	reconnecting = ref(false);
	connected = ref(false);
	roomName = ref("");
	reconnectAttempts = ref(0);
	kickReason: Ref<OttWebsocketError | null> = ref(null);

	private socket: WebSocket | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private messageHandlers = new Map<string, ((msg: ServerMessage) => void)[]>();
	private eventHandlers = new Map<ConnectionEventKind, ((e: unknown) => void)[]>();

	constructor() {}

	/**
	 * Indicates if the client is actively attempting to maintain a connection. Not an indication of whether the connection is connected, see `connected`.
	 * @returns true if the client is actively attempting to maintain a connection to a room.
	 *
	 * @deprecated use `active` instead
	 */
	isActive() {
		return this.active.value;
	}

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
		this.doConnect();
	}

	private doConnect() {
		let url = this.connectionUrl;
		this.socket = new WebSocket(url);
		console.debug(`connecting to ${url}`);
		this.socket.addEventListener("open", () => this.onOpen());
		this.socket.addEventListener("close", (e) => this.onClose(e));
		this.socket.addEventListener("message", (e) => this.onMessage(e));
		this.socket.addEventListener("error", (e) => this.onError(e));
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
		console.info("socket open");
		let authMsg: ClientMessageAuthenticate = {
			action: "auth",
			token: window.localStorage.getItem("token") as AuthToken
		};
		this.send(authMsg);
		// this.store.dispatch("connection/SOCKET_OPEN");
	}

	private onClose(e: { code: number; }) {
		console.info("socket closed", e);
		this.connected.value = false;
		this.socket = null;
		this.dispatchEvent({ kind: "disconnected" });
		// this.store.dispatch("connection/SOCKET_CLOSE", e.code);
		if (e.code >= 4000) {
			// this.store.dispatch("connection/JOIN_ROOM_FAILED", e.code);
			this.kickReason.value = e.code;
			this.dispatchEvent({ kind: "kicked", reason: e.code });
			this.active.value = false;
		} else if (this.active.value) {
			this.reconnecting.value = true;
			this.reconnectTimeout = setTimeout(this.reconnect, 2000);
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

	addMessageHandler(action: string, handler: (msg: ServerMessage) => void) {
		let handlers = this.messageHandlers.get(action) ?? [];
		handlers.push(handler);
		this.messageHandlers.set(action, handlers);
	}

	removeMessageHandler(action: string, handler: (msg: ServerMessage) => void) {
		let handlers = this.messageHandlers.get(action) ?? [];
		let index = handlers.indexOf(handler);
		if (index >= 0) {
			handlers.splice(index, 1);
			this.messageHandlers.set(action, handlers);
		}
	}

	private handleMessage(msg: ServerMessage) {
		let handlers = this.messageHandlers.get(msg.action) ?? [];
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
	const connection = new OttRoomConnection();
	app.provide(connectionInjectKey, connection);
};

export default OttRoomConnectionPlugin;
