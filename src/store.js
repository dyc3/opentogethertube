import Vue from 'vue';
import Vuex from 'vuex';
import _ from 'lodash';

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
		username: null,
		room: {
			name: "",
			title: "",
			description: "",
			isTemporary: false,
			currentSource: {},
			queue: [],
			isPlaying: false,
			playbackPosition: 0,
			chatMessages: [],
			events: [],
		},
	},
	mutations:{
		SOCKET_ONOPEN (state, event)  {
			console.log("socket open");
			state.joinFailureReason = null;
			Vue.prototype.$socket = event.currentTarget;
			state.socket.isConnected = true;
			let username = window.localStorage.getItem("username");
			if (username) {
				state.username = username;
				Vue.prototype.$socket.sendObj({ action: "set-name", name: username });
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

			this.state.username = _.find(this.state.room.users, { isYou: true }).name;

			Vue.prototype.$events.emit('onSync');
		},
		chat(context, message) {
			this.state.room.chatMessages.push(message);
		},
		event(context, message) {
			let event = message.event;
			event.isVisible = true;
			this.state.room.events.push(event);
			Vue.prototype.$events.emit('onRoomEvent', message.event);
		},
	},
});
