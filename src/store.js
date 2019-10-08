import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
	state: {
		socket: {
			isConnected: false,
			message: '',
			reconnectError: false,
		},
		joinFailureReason: null,
		production: process.env.NODE_ENV === 'production',
		room: {
			name: "",
			title: "",
			description: "",
			isTemporary: false,
			currentSource: "",
			queue: [],
			isPlaying: false,
			playbackPosition: 0,
		},
	},
	mutations:{
		SOCKET_ONOPEN (state, event)  {
			console.log("socket open");
			state.joinFailureReason = null;
			Vue.prototype.$socket = event.currentTarget;
			state.socket.isConnected = true;
			let username = window.localStorage.getItem("username");
			if (username != null && username != undefined) {
				Vue.prototype.$socket.sendObj({ action: "set-name", name: username });
			}
			else {
				Vue.prototype.$socket.sendObj({ action: "generate-name" });
			}
		},
		SOCKET_ONCLOSE (state, event)  {
			console.log("socket close", event);
			state.socket.isConnected = false;
			if (event.code == 4002) {
				state.joinFailureReason = "Room does not exist.";
				Vue.prototype.$disconnect();
				Vue.prototype.$events.fire("roomJoinFailure", { reason: "Room does not exist." });
			}
		},
		SOCKET_ONERROR (state, event)  {
			console.error(state, event);
		},
		// default handler called for all methods
		SOCKET_ONMESSAGE (state, message)  {
			console.log("socket message");
			state.socket.message = message;
		},
		// mutations for reconnect methods
		SOCKET_RECONNECT(state, count) {
			console.info("reconnect", state, count);
		},
		SOCKET_RECONNECT_ERROR(state) {
			state.socket.reconnectError = true;
        },
        updateRoom(state, room) {
            state.room = room;
        },
	},
	actions: {
		sendMessage(context, message) {
			Vue.prototype.$socket.send(message);
		},
		sync(context, message) {
			console.debug("SYNC", message);
			this.state.room.name = message.name;
			this.state.room.title = message.title;
			this.state.room.description = message.description;
			this.state.room.isTemporary = message.isTemporary;
			this.state.room.currentSource = message.currentSource;
			this.state.room.queue = message.queue;
			if (this.state.room.isPlaying != message.isPlaying) {
				this.state.room.isPlaying = message.isPlaying;
				if (message.isPlaying) {
					Vue.prototype.$events.emit("playVideo");
				}
				else {
					Vue.prototype.$events.emit("pauseVideo");
				}
			}
			this.state.room.playbackPosition = message.playbackPosition;
			this.state.room.users = message.users;

			Vue.prototype.$events.emit('onSync');
		},
		generatedName(context, message) {
			console.debug("generated name received from server");
			window.localStorage.setItem("username", message.name);
		},
	},
});
