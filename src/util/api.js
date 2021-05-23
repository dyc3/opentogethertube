import connection from "./connection";

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
	undoEvent(event) {
		connection.send({
			action: "undo",
			event,
		});
		// window.vm.$store.state.room.events.splice(idx, 1);
	},
	kickMe() {
		connection.send({
			action: "kickme",
		});
	},
	promoteUser(username, role) {
		connection.send({
			action: "set-role",
			username,
			role,
		});
	},
};
