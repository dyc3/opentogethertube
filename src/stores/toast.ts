import _ from 'lodash';
import { Commit, Dispatch, Module } from 'vuex/types';

import { Toast } from '../models/toast';

interface RootState {}

interface ToastState {
	notifications: Toast[]
}

export const toastModule: Module<ToastState, RootState> = {
	namespaced: true,
	state: {
		notifications: [],
	},
	mutations: {
		ADD_TOAST(state: ToastState, notification: Toast & { id: any }) {
			state.notifications.push({
				...notification,
				id: Symbol(),
			});
		},
		REMOVE_TOAST(state: ToastState, id: any) {
			state.notifications = _.remove(state.notifications, { id });
		},
	},
};
