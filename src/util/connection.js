let socket = null;
let all_sockets = [];

window.vm.$events.on("socket-open", () => {
	console.log("socket open");
	window.vm.$store.state.$connection.isConnected = true;
});

window.vm.$events.on("socket-close", () => {
	console.log("socket closed");
	window.vm.$store.state.$connection.isConnected = false;
});

window.vm.$events.on("socket-message-json", (msg) => {
	console.log("socket message", msg);

	window.vm.$store.dispatch(msg.action, msg);
});

window.vm.$events.on("socket-error", (e) => {
	console.log("socket error", e);
});

function onOpen(e) {
	window.vm.$events.fire("socket-open", e);
}

function onClose(e) {
	window.vm.$events.fire("socket-close", e);
	socket.removeEventListener("open", onOpen);
	socket.removeEventListener("close", onClose);
	socket.removeEventListener("message", onMessage);
	socket.removeEventListener("error", onError);
	socket = null;
}

function onMessage(e) {
	if (typeof e.data === "string") {
		try {
			let msg = JSON.parse(e.data);
			window.vm.$events.fire("socket-message-json", msg);
		}
		catch (error) {
			console.warn("unable to parse message into JSON: ", e.data);
		}
	}
	else {
		console.warn("received unknown binary message", e.data);
	}
}

function onError(e) {
	window.vm.$events.fire("socket-error", e);
}

export default {
	connect(roomName) {
		if (window.vm.$store.state.$connection.isConnected) {
			console.warn("already connected");
			return;
		}

		let url = `${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${roomName}`;
		console.debug("connecting to", url);
		socket = new WebSocket(url);
		all_sockets.push(socket);
		socket.addEventListener("open", onOpen);
		socket.addEventListener("close", onClose);
		socket.addEventListener("message", onMessage);
		socket.addEventListener("error", onError);
	},

	disconnect() {
		if (!window.vm.$store.state.$connection.isConnected) {
			console.warn("not connected, so can't disconnect");
			return;
		}
		socket.close();
	},

	send(msg) {
		if (typeof msg === "string") {
			throw new TypeError("invalid message type");
		}
		if (!window.vm.$store.state.$connection.isConnected) {
			throw new Error("Not connected to socket");
		}

		let text = JSON.stringify(msg);
		socket.send(text);
	},
};

