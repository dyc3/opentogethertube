let socket = null;
let all_sockets = [];

// window.vm.$events.on("socket-error", (e) => {
// });

function onOpen(e) {
	console.log("socket open");
	window.vm.$store.state.$connection.isConnected = true;
	window.vm.$store.state.$connection.reconnect.attempts = 0;
	window.vm.$events.fire("socket-open", e);
}

function onClose(e) {
	console.log("socket closed");
	window.vm.$store.state.$connection.isConnected = false;
	socket.removeEventListener("open", onOpen);
	socket.removeEventListener("close", onClose);
	socket.removeEventListener("message", onMessage);
	socket.removeEventListener("error", onError);
	window.vm.$events.fire("socket-close", e);
	socket = null;
	if (window.vm.$store.state.$connection.shouldReconnect && window.vm.$store.state.$connection.room && window.vm.$store.state.$connection.reconnect.attempts < window.vm.$store.state.$connection.reconnect.maxAttempts) {
		let delay = window.vm.$store.state.$connection.reconnect.delay + (window.vm.$store.state.$connection.reconnect.attempts * window.vm.$store.state.$connection.reconnect.delayIncrease);
		console.debug(`waiting to reconnect: ${delay}ms`);
		setTimeout(() => {
			console.log(`reconnecting... ${window.vm.$store.state.$connection.reconnect.attempts}`);
			window.vm.$store.state.$connection.reconnect.attempts++;
			connect(window.vm.$store.state.$connection.room);
		}, delay);
	}
	else {
		console.log("Not attempting to reconnect");
	}
}

function onMessage(e) {
	if (typeof e.data === "string") {
		try {
			let msg = JSON.parse(e.data);
			window.vm.$store.dispatch(msg.action, msg);
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
	console.log("socket error", e);
	window.vm.$events.fire("socket-error", e);
}

function connect(roomName) {
	if (window.vm.$store.state.$connection.isConnected) {
		console.warn("already connected");
		return;
	}

	let url = `${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${roomName}`;
	console.debug("connecting to", url);
	window.vm.$store.state.$connection.shouldReconnect = true;
	socket = new WebSocket(url);
	all_sockets.push(socket);
	socket.addEventListener("open", onOpen);
	socket.addEventListener("close", onClose);
	socket.addEventListener("message", onMessage);
	socket.addEventListener("error", onError);
	window.vm.$store.state.$connection.room = roomName;
}

function disconnect() {
	if (!window.vm.$store.state.$connection.isConnected) {
		console.warn("not connected, so can't disconnect");
		return;
	}
	window.vm.$store.state.$connection.shouldReconnect = false;
	window.vm.$store.state.$connection.reconnect.attempts = 0;
	socket.close();
}

function send(msg) {
	if (typeof msg === "string") {
		throw new TypeError("invalid message type");
	}
	if (!window.vm.$store.state.$connection.isConnected) {
		throw new Error("Not connected to socket");
	}

	let text = JSON.stringify(msg);
	socket.send(text);
}

export default {
	connect,
	disconnect,
	send,
};
