import WebSocket from 'ws';
import { getLogger } from "./logger.js";

const log = getLogger("websockets");
export const wss = new WebSocket.Server({ noServer: true });

/**
 * Set up the websocket server.
 *
 * I wish I could put it in the clientmanager instead, but the type annotations were being a huge bitch.
 * @param {*} httpServer
 * @param {*} sessions
 */
export function Setup(httpServer, sessions) {
	log.debug("setting up websocket upgrader...");
	httpServer.on('upgrade', (req, socket, head) => {
		sessions(req, {}, () => {
			wss.handleUpgrade(req, socket, head, ws => {
				wss.emit('connection', ws, req);
			});
		});
	});
}

export default {
	Setup,
	wss,
};
