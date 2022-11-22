import { API } from "@/common-http";
import { RoomRequestType } from "ott-common/models/messages";
import { useConnection } from "../plugins/connection";

let _connection;

/**
 * Defines the HTTP and websocket api, and provides methods for using it.
 * @deprecated use `const roomapi = useRoomApi(useConnection());` instead
 */
export default {
	/** @deprecated use `const roomapi = useRoomApi(useConnection());` instead */
	setConnection(c) {
		_connection = c;
	},

	/** Send a message to play the video. */
	play() {
		let connection = _connection ?? useConnection();
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
		let connection = _connection ?? useConnection();
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
		let connection = _connection ?? useConnection();
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.SkipRequest,
			},
		});
	},
	seek(position) {
		let connection = _connection ?? useConnection();
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
		let connection = _connection ?? useConnection();
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
	kickMe(reason) {
		let connection = _connection ?? useConnection();
		connection.send({
			action: "kickme",
			reason,
		});
	},
	promoteUser(clientId, role) {
		let connection = _connection ?? useConnection();
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
		let connection = _connection ?? useConnection();
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
		let connection = _connection ?? useConnection();
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.PlayNowRequest,
				video,
			},
		});
	},
	shuffle() {
		let connection = _connection ?? useConnection();
		connection.send({
			action: "req",
			request: {
				type: RoomRequestType.ShuffleRequest,
			},
		});
	},
};
