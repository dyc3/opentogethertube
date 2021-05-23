import _ from 'lodash';
import { Module } from 'vuex/types';

import { Toast } from '../models/toast';

interface ToastState {
	notifications: Toast[]
}

export const toastModule: Module<ToastState, unknown> = {
	namespaced: true,
	state: {
		notifications: [],
	},
	mutations: {
		ADD_TOAST(state: ToastState, notification: Omit<Toast, "id">) {
			state.notifications.push({
				...notification,
				id: Symbol(),
			});
		},
		REMOVE_TOAST(state: ToastState, id: symbol) {
			const notifs = state.notifications;
			const idx = _.findIndex(notifs, { id });
			notifs.splice(idx, 1);
			state.notifications = notifs;
		},
	},
};
