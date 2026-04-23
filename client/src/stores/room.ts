import _ from "lodash";
import type { Module } from "vuex/types";
import { Grants } from "ott-common/permissions";
import { QueueMode, Visibility } from "ott-common/models/types";
import type { QueueItem } from "ott-common/models/video";
import dayjs, { type Dayjs } from "dayjs";
import type { ServerMessageSync } from "ott-common/models/messages";
import { deserializeMap, deserializeSet } from "ott-common/serialize";
import { calculateCurrentPosition } from "ott-common/timestamp";
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
			if (message.playbackPosition !== undefined && this.state.room.isPlaying) {
				// playbackPosition and playbackStartTime are a coordinate pair.
				// Only accept a new server position when it differs significantly
				// from our extrapolated position — small deltas are normal network
				// jitter. When we reject the server's position we must also drop it
				// from stateupdate; updating one without the other doubles the
				// elapsed-time offset and pushes truePosition far ahead, triggering
				// repeated seeks.
				//
				// Exception: when transitioning to paused we must always accept the
				// server's freeze position. If we drop it, truePosition falls back to
				// the stale playbackPosition anchor and the watcher seeks all clients
				// back to that stale point the moment isPlaying becomes false.
				const transitioningToPaused =
					message.isPlaying === false && this.state.room.isPlaying === true;
				if (!transitioningToPaused) {
					const calculatedPos = this.state.room.playbackStartTime
						? calculateCurrentPosition(
								this.state.room.playbackStartTime,
								dayjs(),
								this.state.room.playbackPosition,
								this.state.room.playbackSpeed
						  )
						: this.state.room.playbackPosition;
					if (Math.abs(message.playbackPosition - calculatedPos) > 2) {
						this.state.room.playbackStartTime = dayjs();
					} else {
						delete (stateupdate as Partial<RoomState>).playbackPosition;
					}
				}
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
