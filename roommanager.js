const WebSocket = require('ws');

module.exports = function (server) {
	const wss = new WebSocket.Server({ server });

	let rooms = {
		test: {
			currentVideo: "",
			queue: []
		}
	};

	wss.on('connection', (ws) => {

		//connection is up, let's add a simple simple event
		ws.on('message', (message) => {

			//log the received message and send it back to the client
			console.log('[ws] received: %s', message);
			// ws.send(`Hello, you sent -> ${message}`);
		});

		//send immediatly a feedback to the incoming connection
		ws.send('{ action: "sync", currentVideo: "" }');
	});

	return {
		rooms: rooms
	}
}