import Vue from 'vue';
import Vuex from 'vuex';
import { API } from './common-http.js';
import dayjs from 'dayjs';
import connection from "@/util/connection";
import { toastModule } from "@/stores/toast";
import { ToastStyle } from './models/toast';
import eventModule from "@/stores/events";

Vue.use(Vuex);

export default new Vuex.Store({
	state: {
		playerStatus: null,
		playerBufferPercent: null,
		playerBufferSpans: null,
		fullscreen: false,
		$connection: {
			shouldReconnect: false,
			isConnected: false,
			room: null,
			reconnect: {
				delay: 2000,
				delayIncrease: 1000,
				attempts: 0,
				maxAttempts: 10,
			},
		},
		joinFailureReason: null,
		production: process.env.NODE_ENV === 'production',
		/** Unregistered user's username  */
		username: null,
		/** Registered user */
		user: null,
		/** Current user's role */
		yourRole: 0,
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
			grants: 0,
			chatMessages: [],
			events: [],
		},

		// used for prompting the user if they want to add the video they came from or the video linked to the queue
		quickAdd: [],

		keepAliveInterval: null,
		/** Permissions metadata */
		permsMeta: {
			loaded: false,
			roles: {},
			permissions: [],
		},
	},
	mutations:{
		PLAYBACK_STATUS(state, message) {
			if (state.playerStatus !== message) {
				state.playerStatus = message;
				connection.send({ action: "status", status: message });
			}
		},
		PLAYBACK_BUFFER(state, percent) {
			state.playerBufferPercent = percent;
		},
		PLAYBACK_BUFFER_SPANS(state, spans) {
			state.playerBufferSpans = spans;
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
		PERMISSIONS_METADATA(state, metadata) {
			for (let role of metadata.roles) {
				state.permsMeta.roles[role.id] = role;
			}
			state.permsMeta.permissions = metadata.permissions;
			state.permsMeta.loaded = true;
		},
	},
	actions: {
		sync(context, message) {
			console.debug("SYNC", message);
			delete message.action;
			if (message.isPlaying !== undefined && this.state.room.isPlaying !== message.isPlaying) {
				Vue.prototype.$events.emit(message.isPlaying ? "playVideo" : "pauseVideo");
				if (message.isPlaying) {
					this.state.room.playbackStartTime = dayjs();
				}
			}
			// FIXME: the UI needs to be able to handle null currentSource
			if (message.currentSource === null) {
				message.currentSource = {};
			}
			// HACK: this lets vue detect the changes and react to them
			// https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
			this.state.room = Object.assign({}, this.state.room, message);

			// FIXME: implement or create alternative
			// if (!this.user) {
			// 	let you = _.find(this.state.room.users, { isYou: true });
			// 	this.state.username = you.name;
			// 	this.state.yourRole = you.role;
			// }

			Vue.prototype.$events.emit('onSync');
		},
		chat(context, message) {
			this.state.room.chatMessages.push(message);
		},
		announcement(context, message) {
			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Neutral,
				content: message.text,
				duration: 15000,
			});
		},
		error(context, message) {
			// console.log(`Server sent error: ${message.error}`);
			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Error,
				content: message.error,
				duration: 5000,
			});
		},
		async updatePermissionsMetadata(context) {
			if (context.state.permsMeta.loaded) {
				return;
			}
			let resp = await API.get("/data/permissions");
			let meta = resp.data;
			context.commit("PERMISSIONS_METADATA", meta);
		},
	},
	modules: {
		toast: toastModule,
		events: eventModule,
	},
});
