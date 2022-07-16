import { Module } from "vuex/types";
import vuetify from "@/plugins/vuetify";

export interface SettingsState {
	volume: number;
	locale: string;
	roomLayout: RoomLayoutMode;
	theme: Theme;
}

export enum RoomLayoutMode {
	default = "default",
	theater = "theater",
}

export enum Theme {
	light = "light",
	dark = "dark",
}

export const settingsModule: Module<SettingsState, unknown> = {
	namespaced: true,
	state: {
		volume: 100,
		locale: "en",
		roomLayout: RoomLayoutMode.default,
		theme: Theme.dark,
	},
	mutations: {
		UPDATE(state, settings: Partial<SettingsState>) {
			Object.assign(state, settings);
			localStorage.setItem("settings", JSON.stringify(state));

			// apply some global settings
			if (settings.theme !== undefined) {
				// this is set up so that if the value of theme is invalid,
				// it will default back to the dark theme instead of the light one.
				switch (settings.theme) {
					case Theme.dark:
						vuetify.framework.theme.dark = true;
						break;
					case Theme.light:
						vuetify.framework.theme.dark = false;
						break;
					default:
						vuetify.framework.theme.dark = true;
						break;
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
