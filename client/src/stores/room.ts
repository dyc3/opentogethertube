import dayjs, { Dayjs } from "dayjs";
import _ from "lodash";
import { ServerMessageSync } from "ott-common/models/messages";
import { QueueMode } from "ott-common/models/types";
import { QueueItem } from "ott-common/models/video";
import { Grants } from "ott-common/permissions";
import { deserializeMap, deserializeSet } from "ott-common/serialize";
import Vuex from "vuex";
import type { Module } from "vuex/types";
import type { FullOTTStoreState } from "@/store";

export interface RoomState {
	name: string;
	title: string;
	description: string;
	isTemporary: boolean;
	queueMode: QueueMode;
	currentSource: QueueItem | null;
	queue: QueueItem[];
	isPlaying: boolean;
	playbackPosition: number;
	playbackSpeed: number;
	hasOwner: boolean;
	voteCounts?: Map<string, number>;
	playbackStartTime: Dayjs | undefined;
	videoSegments?: {
		startTime: number;
		endTime: number;
		videoDuration: number;
		category: string;
	}[];
	grants: Grants;
	prevQueue: QueueItem[] | null;
	enableVoteSkip: boolean;
	votesToSkip: Set<string>;
}

export const roomModule: Module<RoomState, FullOTTStoreState> = {
	namespaced: true,
	state: {
		name: "",
		title: "",
		description: "",
		isTemporary: false,
		queueMode: QueueMode.Manual,
		currentSource: {} as QueueItem,
		queue: [],
		isPlaying: false,
		playbackPosition: 0,
		playbackSpeed: 1,
		hasOwner: false,
		voteCounts: undefined,
		playbackStartTime: undefined,
		grants: new Grants(),
		prevQueue: null,
		enableVoteSkip: false,
		votesToSkip: new Set(),
		videoSegments: [],
	},
	mutations: {
		SYNC(state, stateupdate: Partial<RoomState>) {
			// HACK: this lets vue detect the changes and react to them
			Object.assign(state, stateupdate);
		},
	},
	actions: {
		sync(context, message: ServerMessageSync) {
			const stateupdate: Partial<RoomState> = {
				..._.omit(message, ["action", "grants", "voteCounts", "votesToSkip"]),
			} as any;
			if (
				message.isPlaying !== undefined &&
				this.state.room.isPlaying !== message.isPlaying
			) {
				if (message.isPlaying) {
					this.state.room.playbackStartTime = dayjs();
				}
			}
			if (
				(message.currentSource || message.playbackPosition !== undefined) &&
				this.state.room.isPlaying
			) {
				this.state.room.playbackStartTime = dayjs();
			}
			if ("currentSource" in message) {
				this.commit("PLAYBACK_BUFFER_RESET");
			}
			if (message.voteCounts) {
				stateupdate.voteCounts = deserializeMap(message.voteCounts);
			}
			if (message.grants) {
				stateupdate.grants = new Grants(message.grants);
			}
			if (message.votesToSkip) {
				stateupdate.votesToSkip = deserializeSet(message.votesToSkip);
			}
			context.commit("SYNC", stateupdate);
		},
	},
};
