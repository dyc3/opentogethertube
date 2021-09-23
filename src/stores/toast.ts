import { RoomRequestType } from 'common/models/messages';
import _ from 'lodash';
import { Module } from 'vuex/types';

import { Toast } from '../models/toast';

export interface ToastState {
	notifications: Toast[]
}

export const toastModule: Module<ToastState, unknown> = {
	namespaced: true,
	state: {
		notifications: [],
	},
	mutations: {
		ADD_TOAST(state: ToastState, notification: Omit<Toast, "id">) {
			if (state.notifications.length > 0) {
				const last = state.notifications[state.notifications.length - 1];
				if (notification.event?.request.type === last.event?.request.type) {
					if (last.event?.request.type === RoomRequestType.PlaybackRequest) {
						state.notifications.splice(state.notifications.length - 1, 1);
					}
				}
			}
			state.notifications.push({
				...notification,
				id: Symbol(),
			});
		},
		REMOVE_TOAST(state: ToastState, id: symbol) {
			const idx = _.findIndex(state.notifications, { id });
			state.notifications.splice(idx, 1);
		},
		CLEAR_ALL_TOASTS(state: ToastState) {
			state.notifications = [];
		},
	},
};
