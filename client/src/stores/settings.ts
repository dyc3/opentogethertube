import { Module } from "vuex/types";
import vuetify from "@/plugins/vuetify";

export interface SettingsState {
	volume: number;
	locale: string;
	roomLayout: RoomLayoutMode;
	theme: Theme;
	sfxEnabled: boolean;
	sfxVolume: number;
}

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
}

export const ALL_THEMES = Object.keys(Theme).filter(key => Theme[key]);

export const settingsModule: Module<SettingsState, unknown> = {
	namespaced: true,
	state: {
		volume: 100,
		locale: "en",
		roomLayout: RoomLayoutMode.default,
		theme: Theme.dark,
		sfxEnabled: true,
		sfxVolume: 0.8,
	},
	mutations: {
		UPDATE(state, settings: Partial<SettingsState>) {
			Object.assign(state, settings);
			localStorage.setItem("settings", JSON.stringify(state));

			// apply some global settings
			if (settings.theme !== undefined) {
				if (ALL_THEMES.includes(settings.theme)) {
					vuetify.theme.global.name.value = settings.theme;
				} else {
					console.warn(
						`Can't apply invalid theme: ${settings.theme}, defaulting to dark theme`
					);
					vuetify.theme.global.name.value = Theme.dark;
				}
			}
		},
	},
	actions: {
		load(context) {
			let loaded = JSON.parse(localStorage.getItem("settings") ?? "{}");
			context.commit("UPDATE", loaded);
		},
	},
};
