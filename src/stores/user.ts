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
		},
	},
	actions: {
		user(context, message: ServerMessageUser) {
			if (message.user.isYou) {
				context.state.you = Object.assign(context.state.you, message.user);
			}
		},
	},
};
