import { Module } from 'vuex';
import { ToastStyle } from '@/models/toast';
import { RoomRequestType, ServerMessageEvent } from 'common/models/messages';
import { secondsToTimestamp } from "@/timestamp";

export const module: Module<unknown, unknown> = {
	actions: {
		event(context, message: ServerMessageEvent) {
			let text = `TODO: room event: ${message.request.type}`;
			let duration = 5000;
			if (message.request.type === RoomRequestType.PlaybackRequest) {
				duration = 3000;
				if (message.additional && "state" in message.additional) {
					if (message.additional.state) {
						text = `${message.user.name} played the video`;
					}
					else {
						text = `${message.user.name} paused the video`;
					}
				}
			}
			else if (message.request.type === RoomRequestType.SkipRequest) {
				if (message.additional && "video" in message.additional) {
					text = `${message.user.name} skipped ${message.additional.video.title}`;
				}
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.SeekRequest) {
				if ("value" in message.additional) {
					text = `${message.user.name} seeked to ${secondsToTimestamp(message.additional.value)}`;
				}
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.JoinRequest) {
				text = `${message.user.name} joined the room`;
			}
			else if (message.request.type === RoomRequestType.LeaveRequest) {
				if ("user" in message.additional) {
					text = `${message.additional.user.name} left the room`;
				}
			}
			else if (message.request.type === RoomRequestType.AddRequest) {
				if ("videos" in message.additional) {
					text = `${message.user.name} added ${message.additional.videos.length} videos`;
				}
				else if ("video" in message.additional) {
					text = `${message.user.name} added ${message.additional.video.title}`;
				}
				duration = 7000;
			}
			else if (message.request.type === RoomRequestType.RemoveRequest) {
				if ("video" in message.additional) {
					text = `${message.user.name} removed ${message.additional.video.title}`;
				}
				duration = 7000;
			}

			this.commit("toast/ADD_TOAST", {
				style: ToastStyle.Neutral,
				content: text,
				duration,
				event: message,
			});
		},
	},
};

export default module;
