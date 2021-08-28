import connection from "./connection";
import { API } from '@/common-http';

/**
 * Defines the HTTP and websocket api, and provides methods for using it.
 */
export default {
	/** Send a message to play the video. */
	play() {
		connection.send({ action: "play" });
	},
	/** Send a message to pause the video. */
	pause() {
		connection.send({ action: "pause" });
	},

	/** Send a message to skip the current video. */
	skip() {
		connection.send({ action: "skip" });
	},
	seek(position) {
		connection.send({ action: "seek", position });
	},
	/**
	 * Move the video from `fromIdx` to `toIdx` in the queue.
	 * @param {Number} fromIdx
	 * @param {Number} toIdx
	 * */
	queueMove(fromIdx, toIdx) {
		connection.send({
			action: "queue-move",
			currentIdx: fromIdx,
			targetIdx: toIdx,
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
			action: "set-role",
			clientId,
			role,
		});
	},
	/**
	 * @param {VideoId} video
	 */
	playNow(video) {
		connection.send({
			action: "play-now",
			video,
		});
	},
};
