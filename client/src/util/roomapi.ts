import { OttRoomConnection } from "@/plugins/connection";
import { RoomRequestType } from "ott-common/models/messages";
import { ClientId, Role } from "ott-common/models/types";
import { VideoId } from "ott-common/models/video";

export function useRoomApi(connection: OttRoomConnection) {
	return new RoomApi(connection);
}

class RoomApi {
	private connection: OttRoomConnection;

	constructor(connection: OttRoomConnection) {
		this.connection = connection;
	}

	/** Send a message to play the video. */
	play() {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlaybackRequest,
				state: true,
			},
		});
	}

	/** Send a message to pause the video. */
	pause() {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlaybackRequest,
				state: false,
			},
		});
	}

	/** Send a message to skip the current video. */
	skip() {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.SkipRequest,
			},
		});
	}

	seek(position: number) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.SeekRequest,
				value: position,
			},
		});
	}

	/**
	 * Move the video from `fromIdx` to `toIdx` in the queue.
	 * */
	queueMove(fromIdx: number, toIdx: number) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.OrderRequest,
				fromIdx,
				toIdx,
			},
		});
	}

	async undoEvent(event) {
		throw new Error("Not yet implemented");
		// await API.post(`/room/${this.$route.params.roomId}/undo`, { data: { event } });
	}

	kickMe(reason?: number) {
		this.connection.send({
			action: "kickme",
			reason,
		});
	}

	promoteUser(clientId: ClientId, role: Role) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PromoteRequest,
				targetClientId: clientId,
				role,
			},
		});
	}

	chat(text: string) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.ChatRequest,
				text,
			},
		});
	}

	playNow(video: VideoId) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlayNowRequest,
				video,
			},
		});
	}

	shuffle() {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.ShuffleRequest,
			},
		});
	}

	setPlaybackRate(rate: number) {
		this.connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlaybackSpeedRequest,
				speed: rate,
			},
		});
	}
}
