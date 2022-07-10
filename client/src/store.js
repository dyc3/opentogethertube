import Vue from "vue";
import Vuex from "vuex";
import dayjs from "dayjs";
import connection from "@/util/connection";
import { toastModule } from "@/stores/toast";
import { usersModule } from "@/stores/user";
import { settingsModule } from "@/stores/settings";
import { ToastStyle } from "./models/toast";
import eventModule from "@/stores/events";
import { QueueMode } from "../../common/models/types";
import { deserializeMap } from "../../common/serialize";
import { OttWebsocketError } from "common/models/types";
import { miscModule } from "@/stores/misc";
import { captionsModule } from "@/stores/captions";

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
		joinFailureReason: "",
		production: process.env.NODE_ENV === "production",
		/** Unregistered user's username  */
		username: null,
		/** Registered user */
		user: null,
		room: {
			name: "",
			title: "",
			description: "",
			isTemporary: false,
			queueMode: QueueMode.Manual,
			currentSource: {},
			queue: [],
			isPlaying: false,
			playbackPosition: 0,
			hasOwner: false,
			chatMessages: [],
		},

		keepAliveInterval: null,
	},
	mutations: {
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
		PLAYBACK_BUFFER_RESET(state) {
			state.playerBufferPercent = null;
			state.playerBufferSpans = null;
		},
		LOGIN(state, user) {
			state.user = user;
		},
		LOGOUT(state) {
			state.user = null;
		},
		JOIN_ROOM_FAILED(state, code) {
			let reason;
			if (code === OttWebsocketError.ROOM_NOT_FOUND) {
				reason = "Room not found.";
			} else if (code === OttWebsocketError.ROOM_UNLOADED) {
				reason = "Room was unloaded.";
			} else if (code === OttWebsocketError.MISSING_TOKEN) {
				reason =
					"A token was not provided. Refresh the page and try again. Otherwise, please open an issue on GitHub.";
			} else {
				reason = "Something happened, but we don't know what. Please report this as a bug.";
			}
			state.joinFailureReason = reason;
			console.log(`Join room failed: ${state.joinFailureReason}`);
			state.$connection.shouldReconnect = false;
			state.$connection.attempts = 0;
		},
	},
	actions: {
		sync(context, message) {
			console.debug("SYNC", message);
			delete message.action;
			if (
				message.isPlaying !== undefined &&
				this.state.room.isPlaying !== message.isPlaying
			) {
				if (message.isPlaying) {
					this.state.room.playbackStartTime = dayjs();
				}
			}
			if ((message.currentSource || message.playbackPosition) && this.state.room.isPlaying) {
				this.state.room.playbackStartTime = dayjs();
			}
			// FIXME: the UI needs to be able to handle null currentSource
			if (message.currentSource === null) {
				message.currentSource = {};
			}
			if ("currentSource" in message) {
				this.commit("PLAYBACK_BUFFER_RESET");
			}
			if (message.voteCounts) {
				message.voteCounts = deserializeMap(message.voteCounts);
			}
			// HACK: this lets vue detect the changes and react to them
			// https://vuejs.org/v2/guide/reactivity.html#Change-Detection-Caveats
			this.state.room = Object.assign({}, this.state.room, message);
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
	},
	modules: {
		toast: toastModule,
		events: eventModule,
		users: usersModule,
		settings: settingsModule,
		misc: miscModule,
		captions: captionsModule,
	},
});
