import _ from "lodash";
import { Module } from "vuex/types";
import Vuex from "vuex";

export interface MiscState {
	isLoadingCreateRoom: boolean;
	cancelledRoomCreation: boolean;
}

/** I couldn't figure out what to name this one. */
export const miscModule: Module<MiscState, unknown> = {
	namespaced: true,
	state: {
		isLoadingCreateRoom: false,
		cancelledRoomCreation: false,
	},
	mutations: {
		CREATING_ROOM(state: MiscState) {
			state.isLoadingCreateRoom = true;
			state.cancelledRoomCreation = false;
		},
		CANCELLED_ROOM_CREATION(state: MiscState) {
			state.cancelledRoomCreation = true;
		},
		ROOM_CREATED(state: MiscState, payload: { name: string }) {
			state.isLoadingCreateRoom = false;
			state.cancelledRoomCreation = false;
		},
		ROOM_CREATE_FAILED(state: MiscState) {
			state.isLoadingCreateRoom = false;
			state.cancelledRoomCreation = false;
		},
	},
};
