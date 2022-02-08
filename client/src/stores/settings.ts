import { Module } from 'vuex/types';

export interface SettingsState {
	volume: number;
	chatVisible: boolean;
	locale: string;
}

export const settingsModule: Module<SettingsState, unknown> = {
	namespaced: true,
	state: {
		volume: 100,
		chatVisible: true,
		locale: 'en',
	},
	mutations: {
		UPDATE(state, settings: Partial<SettingsState>) {
			Object.assign(state, settings);
			localStorage.setItem('settings', JSON.stringify(state));
		},
	},
	actions: {
		load(context) {
			let loaded = JSON.parse(localStorage.getItem('settings') ?? '{}');
			context.commit('UPDATE', loaded);
		},
	},
};
