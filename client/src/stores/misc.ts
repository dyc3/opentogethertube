import _ from "lodash";
import { Module } from "vuex/types";
import Vuex from "vuex";

export interface MiscState {}

/** I couldn't figure out what to name this one. */
export const miscModule: Module<MiscState, unknown> = {
	mutations: {
		ROOM_CREATED(state: MiscState, payload: { name: string }) {},
	},
};
