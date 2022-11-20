import { createStore, Store, useStore as baseUseStore } from "vuex";
import dayjs, { Dayjs } from "dayjs";
import { toastModule, ToastState } from "@/stores/toast";
import { usersModule, UsersState } from "@/stores/users";
import { settingsModule, SettingsState } from "@/stores/settings";
import { ToastStyle } from "./models/toast";
import { eventsModule } from "@/stores/events";
import { QueueMode } from "ott-common/models/types";
import { deserializeMap } from "ott-common/serialize";
import { miscModule, MiscState } from "@/stores/misc";
import { captionsModule, CaptionsState } from "@/stores/captions";
import { QueueItem } from "ott-common/models/video";
import { InjectionKey } from "vue";

export type FullOTTStoreState = BaseStoreState & {
	toast: ToastState;
	users: UsersState;
	settings: SettingsState;
	misc: MiscState;
	captions: CaptionsState;
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
		videoSegments?: { startTime: number, endTime: number, videoDuration: number, category: string }[];
	};

	keepAliveInterval: number | null;

	playerBufferPercent: number | null;
	playerBufferSpans: TimeRanges | null;
	playerStatus: string | null;

	// TODO: rename to "account" ??, make a proper type for this, and move it to it's own store
	user: {
		username: string;
		loggedIn: boolean;
		discordLinked: boolean;
	} | null;
	username: string | null;

	fullscreen: boolean;
	production: boolean;
	shortUrl?: string;
}

export function buildNewStore() {
	return createStore<BaseStoreState>({
		state(): BaseStoreState {
			return {
				playerStatus: null,
				playerBufferPercent: null,
				playerBufferSpans: null,
				fullscreen: false,
				production: import.meta.env.PROD,
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

				shortUrl: import.meta.env.SHORT_URL,
			};
		},
		mutations: {
			PLAYBACK_STATUS(state, message) {
				if (state.playerStatus !== message) {
					state.playerStatus = message;
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
			SET_FULLSCREEN(state, fullscreen) {
				state.fullscreen = fullscreen;
			}
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
				if ((message.currentSource || message.playbackPosition !== undefined) && this.state.room.isPlaying) {
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
		},
	}) as Store<FullOTTStoreState>;
}

export const store: Store<FullOTTStoreState> = buildNewStore();

export const key: InjectionKey<Store<FullOTTStoreState>> = Symbol()

export function useStore(): Store<FullOTTStoreState> {
	return baseUseStore(key) as Store<FullOTTStoreState>;
}
