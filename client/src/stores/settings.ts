import { Module } from "vuex/types";

export interface SettingsState {
	volume: number;
	locale: string;
	roomLayout: RoomLayoutMode;
}

export enum RoomLayoutMode {
	default = "default",
	theater = "theater",
}

export const settingsModule: Module<SettingsState, unknown> = {
	namespaced: true,
	state: {
		volume: 100,
		locale: "en",
		roomLayout: RoomLayoutMode.default,
	},
	mutations: {
		UPDATE(state, settings: Partial<SettingsState>) {
			Object.assign(state, settings);
			localStorage.setItem("settings", JSON.stringify(state));
		},
	},
	actions: {
		load(context) {
			let loaded = JSON.parse(localStorage.getItem("settings") ?? "{}");
			context.commit("UPDATE", loaded);
		},
	},
};
