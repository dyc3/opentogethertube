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
}

export type DefaultRoomSettings = Pick<RoomSettings, "autoSkipSegmentCategories">;

export enum RoomLayoutMode {
	default = "default",
	theater = "theater",
}

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
