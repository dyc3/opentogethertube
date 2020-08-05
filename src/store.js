import Vue from 'vue';
import Vuex from 'vuex';
import _ from 'lodash';
import { API } from './common-http.js';

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
		user: null,
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
			hasOwner: false,
			chatMessages: [],
			events: [],
		},

		// used for prompting the user if they want to add the video they came from or the video linked to the queue
		quickAdd: [],

		keepAliveInterval: null,
	},
	mutations:{
		SOCKET_ONOPEN (state, event)  {
			console.log("socket open");
			state.joinFailureReason = null;
			Vue.prototype.$socket = event.currentTarget;
			state.socket.isConnected = true;
			state.room.chatMessages = [];
			state.room.events = [];
			let username = window.localStorage.getItem("username"); // no longer used, eventually can be removed
			if (!state.user && username) {
				window.localStorage.removeItem('username');
				state.username = username;
				API.post("/user", { username });
			}
			if (state.keepAliveInterval) {
				clearInterval(state.keepAliveInterval);
				state.keepAliveInterval = null;
			}
			state.keepAliveInterval = setInterval(() => {
				Vue.prototype.$socket.sendObj({"action":"ping"});
			}, 95000);
		},
		SOCKET_ONCLOSE (state, event)  {
			console.log("socket close", event);
			state.socket.isConnected = false;
			if (event.code == 4002) {
				state.joinFailureReason = "Room does not exist.";
				Vue.prototype.$disconnect();
				Vue.prototype.$events.fire("roomJoinFailure", { reason: "Room does not exist." });
			}
			if (state.keepAliveInterval) {
				clearInterval(state.keepAliveInterval);
				state.keepAliveInterval = null;
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
		LOGIN(state, user) {
			state.user = user;
		},
		LOGOUT(state) {
			state.user = null;
		},
		QUICKADD_ADD(state, video) {
			state.quickAdd.push(video);
		},
		QUICKADD_CLEAR(state) {
			state.quickAdd = [];
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
			// HACK: this lets vue detect the changes and react to them
			// https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
			this.state.room = Object.assign({}, this.state.room, message);

			if (!this.user) {
				this.state.username = _.find(this.state.room.users, { isYou: true }).name;
			}

			Vue.prototype.$events.emit('onSync');
		},
		chat(context, message) {
			this.state.room.chatMessages.push(message);
		},
		event(context, message) {
			let event = message.event;
			event.isVisible = true;
			event.isUndoable = event.eventType === 'seek' || event.eventType === 'skip' || event.eventType === 'addToQueue' || event.eventType === 'removeFromQueue';
			event.timeout = event.isUndoable ? 7000 : 4000;
			if (event.eventType === 'seek' && this.state.room.events.slice(-1)[0].eventType === 'seek' && this.state.room.events.slice(-1)[0].isVisible) {
				this.state.room.events[this.state.room.events.length - 1].parameters.position = event.parameters.position;
				this.state.room.events[this.state.room.events.length - 1].timeout += 1;
			}
			else {
				this.state.room.events.push(event);
			}
			Vue.prototype.$events.emit('onRoomEvent', message.event);
		},
		announcement(context, message) {
			Vue.prototype.$events.emit('onAnnouncement', message.text);
		},
	},
});
