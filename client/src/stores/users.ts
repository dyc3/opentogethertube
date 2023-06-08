import { ServerMessageUser, ServerMessageYou, PartialUserInfo } from "ott-common/models/messages";
import { ClientId, RoomUserInfo } from "ott-common/models/types";
import { Module } from "vuex/types";
import { API } from "@/common-http";
import { reactive } from "vue";

export interface UsersState {
	users: Map<ClientId, RoomUserInfo>;
	you: {
		id: ClientId;
	};
}

export const usersModule: Module<UsersState, unknown> = {
	state: {
		users: reactive(new Map()),
		you: {
			id: "",
		},
	},
	getters: {
		token(): string | null {
			return window.localStorage.getItem("token");
		},
		self(state): RoomUserInfo | undefined {
			return state.users.get(state.you.id);
		},
	},
	mutations: {
		INIT_USERS(state, payload: RoomUserInfo[]) {
			state.users = new Map(payload.map(u => [u.id, u]));
		},
		UPDATE_USER(state, payload: PartialUserInfo) {
			let user = state.users.get(payload.id);
			if (!user) {
				state.users.set(payload.id, payload as RoomUserInfo);
			} else {
				Object.assign(user, payload);
			}
		},
		REMOVE_USER(state, payload: ClientId) {
			state.users.delete(payload);
		},
		SET_YOU(state, payload: ServerMessageYou) {
			state.you = payload.info;
		},
		SET_AUTH_TOKEN(state, token: string) {
			window.localStorage.setItem("token", token);
		},
	},
	actions: {
		user(context, message: ServerMessageUser) {
			switch (message.update.kind) {
				case "init":
					context.commit("INIT_USERS", message.update.value);
					break;
				case "update":
					context.commit("UPDATE_USER", message.update.value);
					break;
				case "remove":
					context.commit("REMOVE_USER", message.update.value);
					break;
				default:
					console.error("Unknown user update kind", message.update.kind);
					break;
			}
		},
		you(context, message: ServerMessageYou) {
			context.commit("SET_YOU", message);
		},
		async getNewToken(context) {
			const resp = await API.get("/auth/grant");
			context.commit("SET_AUTH_TOKEN", resp.data.token);
		},
		async waitForToken(context) {
			if (context.getters.token) {
				return;
			}
			return new Promise<void>(resolve => {
				this.subscribe(mutation => {
					if (mutation.type === "SET_AUTH_TOKEN") {
						resolve();
					}
				});
			});
		},
	},
};
