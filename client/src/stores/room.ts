import type { Module } from "vuex/types";
import { Grants } from "ott-common/permissions";
import { QueueMode, Visibility } from "ott-common/models/types";
import type { QueueItem } from "ott-common/models/video";
import dayjs, { type Dayjs } from "dayjs";
import type { ServerMessageSync } from "ott-common/models/messages";
import { deserializeMap, deserializeSet } from "ott-common/serialize";
import type { FullOTTStoreState } from "@/store";

export interface RoomState {
	name: string;
	title: string;
	description: string;
	isTemporary: boolean;
	visibility: Visibility;
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
		visibility: Visibility.Unlisted,
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
			const stateupdate: Partial<RoomState> = {};
			if ("name" in message) {
				stateupdate.name = message.name;
			}
			if ("title" in message) {
				stateupdate.title = message.title;
			}
			if ("description" in message) {
				stateupdate.description = message.description;
			}
			if ("isTemporary" in message) {
				stateupdate.isTemporary = message.isTemporary;
			}
			if ("visibility" in message) {
				stateupdate.visibility = message.visibility;
			}
			if ("queueMode" in message) {
				stateupdate.queueMode = message.queueMode;
			}
			if ("isPlaying" in message) {
				stateupdate.isPlaying = message.isPlaying;
			}
			if ("playbackPosition" in message) {
				stateupdate.playbackPosition = message.playbackPosition;
			}
			if ("currentSource" in message) {
				stateupdate.currentSource = message.currentSource;
			}
			if ("queue" in message) {
				stateupdate.queue = message.queue;
			}
			if ("prevQueue" in message) {
				stateupdate.prevQueue = message.prevQueue;
			}
			if ("playbackSpeed" in message) {
				stateupdate.playbackSpeed = message.playbackSpeed;
			}
			if ("hasOwner" in message) {
				stateupdate.hasOwner = message.hasOwner;
			}
			if ("enableVoteSkip" in message) {
				stateupdate.enableVoteSkip = message.enableVoteSkip;
			}
			if ("videoSegments" in message) {
				stateupdate.videoSegments = message.videoSegments;
			}
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
