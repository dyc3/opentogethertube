import { Session } from "express-session";
import WebSocket from "ws";
import { uniqueNamesGenerator } from "unique-names-generator";
import _ from "lodash";
import { wss } from "./websockets.js";
import { getLogger } from "../logger.js";
import { Request } from 'express';

const log = getLogger("clientmanager");
let connections: Client[] = [];

enum OttWebsocketError {
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
}

/**
 * Called when a websocket connects.
 * @param session
 * @param socket
 */
function OnConnect(session: Session, socket: WebSocket, req: Request) {
	let roomName = req.url!.replace("/api/room/", "");
	log.debug(`connection received: ${roomName}`)
	let client = new Client(session, socket);
	connections.push(client);
}

export function Setup() {
	log.debug("setting up client manager...");
	const server = wss as WebSocket.Server;
	server.on("connection", (ws, req: Request & { session: Session }) => {
		if (!req.url!.startsWith("/api/room/")) {
			log.error("Rejecting connection because the connection url was invalid");
			ws.close(OttWebsocketError.INVALID_CONNECTION_URL, "Invalid connection url");
			return;
		}
		OnConnect(req.session, ws, req);
	})
}

export default {
	Setup,
}
