import connection from "./connection";
import { API } from '@/common-http';
import { RoomRequestType } from 'common/models/messages';

/**
 * Defines the HTTP and websocket api, and provides methods for using it.
 */
export default {
	/** Send a message to play the video. */
	play() {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlaybackRequest,
				state: true,
			},
		});
	},
	/** Send a message to pause the video. */
	pause() {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlaybackRequest,
				state: false,
			},
		});
	},

	/** Send a message to skip the current video. */
	skip() {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.SkipRequest,
			},
		});
	},
	seek(position) {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.SeekRequest,
				value: position,
			},
		});
	},
	/**
	 * Move the video from `fromIdx` to `toIdx` in the queue.
	 * @param {Number} fromIdx
	 * @param {Number} toIdx
	 * */
	queueMove(fromIdx, toIdx) {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.OrderRequest,
				fromIdx,
				toIdx,
			},
		});
	},
	async undoEvent(event) {
		// connection.send({
		// 	action: "undo",
		// 	event,
		// });
		await API.post(`/room/${this.$route.params.roomId}/undo`, { data: { event } });
	},
	kickMe() {
		connection.send({
			action: "kickme",
		});
	},
	promoteUser(clientId, role) {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PromoteRequest,
				targetClientId: clientId,
				role,
			},
		});
	},
	chat(text) {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.ChatRequest,
				text,
			},
		});
	},
	/**
	 * @param {VideoId} video
	 */
	playNow(video) {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlayNowRequest,
				video,
			},
		});
	},
	shuffle() {
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.ShuffleRequest,
			},
		});
	},
};
