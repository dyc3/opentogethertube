const WebSocket = require('ws');

module.exports = function (server) {
	function syncRoom(room) {
		let syncMsg = {
			action: "sync",
			name: "test",
			currentSource: room.currentSource,
			queue: room.queue
		};
		for (let i = 0; i < room.clients.length; i++) {
			let ws = room.clients[i].socket;
			if (ws.readyState != 1) {
				continue;
			}
			ws.send(JSON.stringify(syncMsg));
		}
	}

	function updateRoom(room) {
		if (room.currentSource == "" && room.queue.length > 0) {
			room.currentSource = room.queue.shift();
			syncRoom(room);
		}
	}

	const wss = new WebSocket.Server({ server });

	let rooms = {
		test: {
			currentSource: "",
			queue: [],
			clients: []
		}
	};

	wss.on('connection', (ws) => {
		console.log("[ws] CONNECTION ESTABLISHED", ws.protocol, ws.url, ws.readyState);

		rooms["test"].clients.push({
			name: "client",
			socket: ws
		});

		//connection is up, let's add a simple simple event
		ws.on('message', (message) => {

			//log the received message and send it back to the client
			console.log('[ws] received:', typeof(message), message);
			// ws.send(`Hello, you sent -> ${message}`);
		});

		//send immediatly a feedback to the incoming connection
		// ws.send('{ "action": "sync", "name": "test", "currentSource": "" }');
		syncRoom(rooms["test"]);
	});

	return {
		rooms: rooms,
		syncRoom: syncRoom,
		updateRoom: updateRoom
	};
};