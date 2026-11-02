import type { RoomSettings } from "ott-common";
import type { Module } from "vuex/types";

export interface SettingsState {
	volume: number;
	muted: boolean;
	audioBoost: number;
	locale: string;
	roomLayout: RoomLayoutMode;
	theme: Theme;
	sfxEnabled: boolean;
	sfxVolume: number;
	defaultRoomSettings?: DefaultRoomSettings;
	enableAdapterSelector: boolean;
	nativeYoutubeControls: boolean;
	chatPlacement: ChatPlacement;
	/** Width of the room's chat side panel, in pixels. */
	chatPanelWidth: number;
}

export type DefaultRoomSettings = Pick<RoomSettings, "autoSkipSegmentCategories">;

export enum RoomLayoutMode {
	default = "default",
	theater = "theater",
}

/**
 * Where room chat is shown. YouTube's terms don't allow drawing over its player, so
 * `video` falls back to `panel` while a YouTube video is playing.
 */
export enum ChatPlacement {
	video = "video",
	panel = "panel",
}

export const DEFAULT_CHAT_PANEL_WIDTH = 400;

export enum Theme {
	dark = "dark",
	light = "light",
	deepred = "deepred",
	deepblue = "deepblue",
	greenslate = "greenslate",
	ultraviolet = "ultraviolet",
	sunset = "sunset",
	strawberry = "strawberry",
}

export const ALL_THEMES = Object.keys(Theme).filter(key => Theme[key]);

export const settingsModule: Module<SettingsState, unknown> = {
	namespaced: true,
	state: {
		volume: 100,
		muted: false,
		audioBoost: 100,
		locale: "en",
		roomLayout: RoomLayoutMode.default,
		theme: Theme.dark,
		sfxEnabled: true,
		sfxVolume: 0.8,
		enableAdapterSelector: false,
		nativeYoutubeControls: false,
		chatPlacement: ChatPlacement.panel,
		chatPanelWidth: DEFAULT_CHAT_PANEL_WIDTH,
	},
	mutations: {
		UPDATE(state, settings: Partial<SettingsState>) {
			Object.assign(state, settings);
			localStorage.setItem("settings", JSON.stringify(state));

			// apply some global settings
			if (settings.theme !== undefined) {
				const theme = ALL_THEMES.includes(settings.theme) ? settings.theme : Theme.dark;
				if (theme !== settings.theme) {
					console.warn(
						`Can't apply invalid theme: ${settings.theme}, defaulting to dark theme`,
					);
				}
				document.documentElement.dataset.theme = theme;
			}
		},
	},
	actions: {
		load(context) {
			const loaded = JSON.parse(localStorage.getItem("settings") ?? "{}");
			context.commit("UPDATE", loaded);
		},
	},
};
