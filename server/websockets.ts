import WebSocket from "ws";
import { getLogger } from "./logger";
import type { Server } from "http";
import type { Socket } from "net";

const log = getLogger("websockets");
export const wss = new WebSocket.Server({ noServer: true });

/**
 * Set up the websocket server.
 */
export function setup(httpServer: Server) {
	log.debug("setting up websocket upgrader...");
	wss.on("error", e => {
		log.error(`Websocket server error: ${e}`);
	});
	httpServer.on("upgrade", (req, socket, head) => {
		wss.handleUpgrade(req, socket as Socket, head, ws => {
			wss.emit("connection", ws, req);
		});
	});
}

export default {
	setup,
	wss,
};
