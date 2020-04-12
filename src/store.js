import Vue from 'vue';
import Vuex from 'vuex';
import _ from 'lodash';

Vue.use(Vuex);

export default new Vuex.Store({
	state: {
		fullscreen: false,
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
			queueMode: "manual",
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
		PLAYBACK_STATUS(state, message) {
			Vue.prototype.$socket.sendObj({ action: "status", status: message });
		},
	},
	actions: {
		sendMessage(context, message) {
			Vue.prototype.$socket.send(message);
		},
		sync(context, message) {
			console.debug("SYNC", message);
			delete message.action;
			if (message.isPlaying !== undefined && this.state.room.isPlaying != message.isPlaying) {
				if (message.isPlaying) {
					Vue.prototype.$events.emit("playVideo");
				}
				else {
					Vue.prototype.$events.emit("pauseVideo");
				}
			}
			Object.assign(this.state.room, message);

			this.state.username = _.find(this.state.room.users, { isYou: true }).name;

			Vue.prototype.$events.emit('onSync');
		},
		chat(context, message) {
			this.state.room.chatMessages.push(message);
		},
		event(context, message) {
			let event = message.event;
			event.isVisible = true;
			event.isUndoable = event.eventType === 'seek' || event.eventType === 'skip' || event.eventType === 'addToQueue' || event.eventType === 'removeFromQueue';
			this.state.room.events.push(event);
			Vue.prototype.$events.emit('onRoomEvent', message.event);
		},
		announcement(context, message) {
			Vue.prototype.$events.emit('onAnnouncement', message.text);
		},
	},
});
