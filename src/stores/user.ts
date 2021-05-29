import { ServerMessageUser, UserInfo } from 'common/models/messages';
import { Role } from 'common/models/types';
import { Module } from 'vuex/types';

export interface UsersState {
	you: UserInfo
}

export const usersModule: Module<UsersState, unknown> = {
	state: {
		you: {
			id: "",
			name: "",
			isLoggedIn: false,
			role: Role.UnregisteredUser,
			isYou: true,
			grants: 4194303,
		},
	},
	mutations: {
		SET_YOU(state, payload) {
			state.you = Object.assign(state.you, payload);
		},
	},
	actions: {
		user(context, message: ServerMessageUser) {
			if (message.user.isYou) {
				context.commit("SET_YOU", message.user);
			}
		},
	},
};
