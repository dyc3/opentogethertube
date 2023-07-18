import { createStore, Store, useStore as baseUseStore } from "vuex";
import dayjs, { Dayjs } from "dayjs";
import { toastModule, ToastState } from "@/stores/toast";
import { usersModule, UsersState } from "@/stores/users";
import { settingsModule, SettingsState } from "@/stores/settings";
import { ToastStyle } from "./models/toast";
import { eventsModule } from "@/stores/events";
import { QueueMode, RoomUserInfo } from "ott-common/models/types";
import { deserializeMap, deserializeSet } from "ott-common/serialize";
import { miscModule, MiscState } from "@/stores/misc";
import { captionsModule, CaptionsState } from "@/stores/captions";
import { QueueItem } from "ott-common/models/video";
import { InjectionKey } from "vue";
import { Grants } from "ott-common/permissions";
import { ServerMessageSync } from "ott-common/models/messages";
import _ from "lodash";

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
		playbackSpeed: number;
		hasOwner: boolean;
		voteCounts?: Map<string, number>;
		playbackStartTime: Dayjs | undefined;
		videoSegments?: {
			startTime: number;
			endTime: number;
			videoDuration: number;
			category: string;
		}[];
		grants: Grants;
		prevQueue: QueueItem[] | null;
		enableVoteSkip: boolean;
		votesToSkip: Set<string>;
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
					playbackSpeed: 1,
					hasOwner: false,
					voteCounts: undefined,
					playbackStartTime: undefined,
					grants: new Grants(),
					prevQueue: null,
					enableVoteSkip: false,
					votesToSkip: new Set(),
				},

				keepAliveInterval: null,

				shortUrl: import.meta.env.OTT_SHORT_URL_HOSTNAME,
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
			},
		},
		actions: {
			sync(context, message: ServerMessageSync) {
				console.debug("SYNC", message);
				const stateupdate: Partial<BaseStoreState["room"]> = {
					..._.omit(message, ["action", "grants", "voteCounts", "votesToSkip"]),
				};
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
				if ("currentSource" in message) {
					this.commit("PLAYBACK_BUFFER_RESET");
				}
				if (message.voteCounts) {
					stateupdate.voteCounts = deserializeMap(message.voteCounts);
				}
				if (message.grants) {
					stateupdate.grants = new Grants(message.grants);
				}
				if (message.votesToSkip) {
					stateupdate.votesToSkip = deserializeSet(message.votesToSkip);
				}
				// HACK: this lets vue detect the changes and react to them
				Object.assign(this.state.room, stateupdate);
			},
			chat() {},
			announcement(context, message) {
				this.commit("toast/ADD_TOAST", {
					style: ToastStyle.Important,
					content: message.text,
					duration: 60000,
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

export const key: InjectionKey<Store<FullOTTStoreState>> = Symbol();

export function useStore(): Store<FullOTTStoreState> {
	return baseUseStore(key);
}
