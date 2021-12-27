import { ServerMessageUser, UserInfo } from 'common/models/messages';
import { Role } from 'common/models/types';
import { Module } from 'vuex/types';
import { API } from "@/common-http";

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
	getters: {
		token(): string | null {
			return window.localStorage.getItem("token");
		},
	},
	mutations: {
		SET_YOU(state, payload) {
			state.you = Object.assign(state.you, payload);
		},
		SET_AUTH_TOKEN(state, token: string) {
			window.localStorage.setItem("token", token);
		},
	},
	actions: {
		user(context, message: ServerMessageUser) {
			if (message.user.isYou) {
				context.commit("SET_YOU", message.user);
			}
		},
		async getNewToken(context) {
			const resp = await API.get("/auth/grant");
			context.commit("SET_AUTH_TOKEN", resp.data.token);
		},
		async waitForToken(context) {
			if (context.getters.token) {
				return;
			}
			return new Promise<void>((resolve) => {
				this.subscribe((mutation) => {
					if (mutation.type === "SET_AUTH_TOKEN") {
						resolve();
					}
				});
			});
		},
	},
};
