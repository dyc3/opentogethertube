import { Module } from 'vuex';
import { ToastStyle } from '@/models/toast';
import { RoomRequestType, ServerMessageEvent } from '@/common/models/messages';
import { secondsToTimestamp } from "@/timestamp";

export const module: Module<unknown, unknown> = {
	actions: {
		event(context, message: ServerMessageEvent) {
			let text = `TODO: room event: ${message.request.type}`;
			let duration = 5000;
			if (message.request.type === RoomRequestType.PlaybackRequest) {
				duration = 3000;
				if (message.request.state) {
					text = `${message.user.name} played the video`;
				}
				else {
					text = `${message.user.name} paused the video`;
				}
			}
			else if (message.request.type === RoomRequestType.SkipRequest) {
				text = `${message.user.name} skipped the video`; // TODO: include video title
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.SeekRequest) {
				text = `${message.user.name} seeked to ${secondsToTimestamp(message.request.value)}`;
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.JoinRequest) {
				text = `${message.user.name} joined the room`;
			}
			else if (message.request.type === RoomRequestType.LeaveRequest) {
				text = `${message.user.name} left the room`;
			}
			else if (message.request.type === RoomRequestType.AddRequest) {
				if (message.request.videos) {
					text = `${message.user.name} added ${message.request.videos.length} videos`;
				}
				else {
					text = `${message.user.name} added ${message.request.video}`; // TODO: include video title
				}
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.RemoveRequest) {
				text = `${message.user.name} removed ${message.request.video}`; // TODO: include video title
				duration = 7000;
			}
			else {
				text = `${message.user.name} triggered event ${message.request.type}`;
			}

			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Neutral,
				content: text,
				duration,
				event: message.request,
			});
		},
	},
};

export default module;
