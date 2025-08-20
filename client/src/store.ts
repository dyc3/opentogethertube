import _ from "lodash";
import { InjectionKey } from "vue";
import { useStore as baseUseStore, createStore, Store } from "vuex";
import { eventsModule } from "@/stores/events";
import { MiscState, miscModule } from "@/stores/misc";
import { SettingsState, settingsModule } from "@/stores/settings";
import { ToastState, toastModule } from "@/stores/toast";
import { UsersState, usersModule } from "@/stores/users";
import { ToastStyle } from "./models/toast";
import { RoomState, roomModule } from "./stores/room";

export type FullOTTStoreState = BaseStoreState & {
	room: RoomState;
	toast: ToastState;
	users: UsersState;
	settings: SettingsState;
	misc: MiscState;
};

interface BaseStoreState {
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
			PLAYBACK_BUFFER_SPANS(state, spans: TimeRanges) {
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
			// biome-ignore lint/suspicious/noEmptyBlockStatements: biome migration
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
			room: roomModule,
			toast: toastModule,
			events: eventsModule,
			users: usersModule,
			settings: settingsModule,
			misc: miscModule,
		},
	}) as Store<FullOTTStoreState>;
}

export const store: Store<FullOTTStoreState> = buildNewStore();

export const key: InjectionKey<Store<FullOTTStoreState>> = Symbol();

export function useStore(): Store<FullOTTStoreState> {
	return baseUseStore(key);
}
