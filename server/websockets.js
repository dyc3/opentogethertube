import WebSocket from "ws";
import { getLogger } from "./logger";

const log = getLogger("websockets");
export const wss = new WebSocket.Server({ noServer: true });

/**
 * Set up the websocket server.
 *
 * I wish I could put it in the clientmanager instead, but the type annotations were being a huge bitch.
 * @param {*} httpServer
 * @param {*} sessions
 */
export function setup(httpServer) {
	log.debug("setting up websocket upgrader...");
	wss.on("error", e => {
		log.error(`Websocket server error: ${e}`);
	});
	httpServer.on("upgrade", (req, socket, head) => {
		wss.handleUpgrade(req, socket, head, ws => {
			wss.emit("connection", ws, req);
		});
	});
}

export default {
	setup,
	wss,
};
