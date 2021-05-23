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
			let notifs = state.notifications;
			// FIXME: for some reason, removes multiple toasts, but should only remove one.
			notifs = _.remove(notifs, { id });
			state.notifications = notifs;
		},
	},
};
