import _ from "lodash";
import { Module } from "vuex/types";
import Vuex from "vuex";

export interface CaptionsState {
	availableTracks: string[];
}

export const captionsModule: Module<CaptionsState, unknown> = {
	namespaced: true,
	state: {
		availableTracks: [],
	},
	mutations: {
		SET_AVAILABLE_TRACKS(state: CaptionsState, payload: { tracks: string[] }) {
			state.availableTracks = payload.tracks;
		},
	},
};
