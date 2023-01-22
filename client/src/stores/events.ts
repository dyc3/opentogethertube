// Ignoring because this rule is wrong. all the template strings in here use strings.
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { Module } from "vuex";
import { ToastStyle } from "@/models/toast";
import {
	RoomRequestType,
	ServerMessageEvent,
	ServerMessageEventCustom,
} from "ott-common/models/messages";
import { secondsToTimestamp } from "@/util/timestamp";

export const eventsModule: Module<unknown, unknown> = {
	actions: {
		event(context, message: ServerMessageEvent) {
			let text = `TODO: room event: ${message.request.type}`;
			let duration = 5000;
			if (message.request.type === RoomRequestType.PlaybackRequest) {
				duration = 3000;
				if (message.request.state) {
					text = `${message.user.name} played the video`;
				} else {
					text = `${message.user.name} paused the video`;
				}
			} else if (
				message.request.type === RoomRequestType.SkipRequest &&
				message.additional.video
			) {
				text = `${message.user.name} skipped ${message.additional.video.title}`;
				duration = 7000;
			} else if (message.request.type === RoomRequestType.SeekRequest) {
				text = `${message.user.name} seeked to ${secondsToTimestamp(
					message.request.value
				)}`;
				duration = 7000;
			} else if (message.request.type === RoomRequestType.JoinRequest) {
				text = `${message.user.name} joined the room`;
			} else if (
				message.request.type === RoomRequestType.LeaveRequest &&
				message.additional.user
			) {
				text = `${message.additional.user.name} left the room`;
			} else if (message.request.type === RoomRequestType.AddRequest) {
				if (message.request.videos) {
					text = `${message.user.name} added ${message.request.videos.length} videos`;
				} else if (message.additional.video) {
					text = `${message.user.name} added ${message.additional.video.title}`;
				} else {
					text = `${message.user.name} added a video`;
				}
				duration = 7000;
			} else if (message.request.type === RoomRequestType.RemoveRequest) {
				if (message.additional.video) {
					text = `${message.user.name} removed ${message.additional.video.title}`;
				} else {
					text = `${message.user.name} removed a video`;
				}
				duration = 7000;
			} else {
				text = `${message.user.name} triggered event ${message.request.type}`;
			}

			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Neutral,
				content: text,
				duration,
				event: message,
			});
		},
		eventcustom(context, message: ServerMessageEventCustom) {
			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Neutral,
				content: message.text,
				duration: message.duration ?? 3000,
			});
		},
	},
};

export default eventsModule;
