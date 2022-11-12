import _ from "lodash";
import { Module } from "vuex/types";
import Vuex from "vuex";
import { OttWebsocketError } from "common/models/types";

export interface ConnectionState {
	disconnected: {
		reason: OttWebsocketError;
	} | null;
	shouldReconnect: boolean;
	isConnected: boolean;
	room: string | null;
	reconnect: {
		delay: number;
		delayIncrease: number;
		attempts: number;
		maxAttempts: number;
	};
}

export const connectionModule: Module<ConnectionState, unknown> = {
	namespaced: true,
	state: {
		disconnected: null,
		shouldReconnect: false,
		isConnected: false,
		room: null,
		reconnect: {
			delay: 2000,
			delayIncrease: 1000,
			attempts: 0,
			maxAttempts: 10,
		},
	},
	mutations: {
		SOCKET_OPEN(state: ConnectionState) {
			state.disconnected = null;
			state.isConnected = true;
		},
		SOCKET_CLOSE(state: ConnectionState, code: number) {
			state.isConnected = false;
		},
		SET_RECONNECTING(state: ConnectionState, reconnecting: boolean) {
			state.shouldReconnect = reconnecting;
		},
		JOIN_ROOM_FAILED(state: ConnectionState, code: number) {
			state.disconnected = { reason: code };
			state.shouldReconnect = false;
			state.reconnect.attempts = 0;
		},
	},
};
