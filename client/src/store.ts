import { createStore, Store, useStore as baseUseStore } from "vuex";
import dayjs, { Dayjs } from "dayjs";
import connection from "@/util/connection";
import { toastModule, ToastState } from "@/stores/toast";
import { usersModule, UsersState } from "@/stores/users";
import { settingsModule, SettingsState } from "@/stores/settings";
import { ToastStyle } from "./models/toast";
import { eventsModule } from "@/stores/events";
import { QueueMode } from "../../common/models/types";
import { deserializeMap } from "../../common/serialize";
import { miscModule, MiscState } from "@/stores/misc";
import { captionsModule, CaptionsState } from "@/stores/captions";
import { connectionModule, ConnectionState } from "@/stores/connection";
import { QueueItem } from "common/models/video";
import { InjectionKey } from "vue";

export type FullOTTStoreState = BaseStoreState & {
	toast: ToastState;
	users: UsersState;
	settings: SettingsState;
	misc: MiscState;
	captions: CaptionsState;
	connection: ConnectionState;
};

interface BaseStoreState {
	room: {
		name: string;
		title: string;
		description: string;
		isTemporary: boolean;
		queueMode: QueueMode;
		currentSource: QueueItem | null;
		queue: QueueItem[];
		isPlaying: boolean;
		playbackPosition: number;
		hasOwner: boolean;
		chatMessages: unknown[];
		voteCounts?: Map<string, number>;
		playbackStartTime: Dayjs | undefined;
	};

	keepAliveInterval: number | null;

	playerBufferPercent: number | null;
	playerBufferSpans: number | null;
	playerStatus: string | null;

	user: unknown | null;
	username: string | null;

	fullscreen: boolean;
	production: boolean;
}

export const store: Store<FullOTTStoreState> = createStore<BaseStoreState>({
	state(): BaseStoreState {
		return {
			playerStatus: null,
			playerBufferPercent: null,
			playerBufferSpans: null,
			fullscreen: false,
			production: import.meta.env.NODE_ENV === "production",
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
				currentSource: {} as QueueItem,
				queue: [],
				isPlaying: false,
				playbackPosition: 0,
				hasOwner: false,
				chatMessages: [],
				voteCounts: undefined,
				playbackStartTime: undefined
			},

			keepAliveInterval: null,
		};
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
			if (
				(message.currentSource || message.playbackPosition !== undefined) &&
				this.state.room.isPlaying
			) {
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
		events: eventsModule,
		users: usersModule,
		settings: settingsModule,
		misc: miscModule,
		captions: captionsModule,
		connection: connectionModule,
	},
}) as Store<FullOTTStoreState>;

export const key: InjectionKey<Store<FullOTTStoreState>> = Symbol()

export function useStore(): Store<FullOTTStoreState> {
	return baseUseStore(key) as Store<FullOTTStoreState>;
}
