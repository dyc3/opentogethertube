<template>
	<v-sheet class="mt-2 video" hover>
		<div class="img-container">
			<v-img
				:src="thumbnailSource"
				:lazy-src="placeholderUrl"
				aspect-ratio="1.8"
				@error="onThumbnailError"
			>
				<span
					class="drag-handle"
					v-if="!isPreview && store.state.room.queueMode !== QueueMode.Vote"
				>
					<v-icon>fa:fas fa-align-justify</v-icon>
				</span>
				<span class="video-length">{{ videoLength }}</span>
			</v-img>
		</div>
		<div class="meta-container">
			<div>
				<div class="video-title" no-gutters>{{ item.title }}</div>
				<div class="description text-truncate" no-gutters>{{ item.description }}</div>
				<div v-if="item.service === 'googledrive'" class="experimental">
					{{ $t("video-queue-item.experimental") }}
				</div>
				<span v-if="item.startAt !== undefined" class="video-start-at">
					{{ $t("video-queue-item.start-at", { timestamp: videoStartAt }) }}
				</span>
			</div>
		</div>
		<div class="d-flex" style="justify-content: center; flex-direction: column">
			<div class="button-container" v-if="!hideAllButtons">
				<v-btn
					class="button-with-icon"
					@click="vote"
					:loading="isLoadingVote"
					:color="voted ? 'red' : 'green'"
					v-if="!isPreview && store.state.room.queueMode === QueueMode.Vote"
					data-cy="btn-vote"
				>
					<span>{{ votes }}</span>
					<v-icon>fa:fas fa-thumbs-up</v-icon>
					<span class="vote-text">{{ item.voted ? "Unvote" : "Vote" }}</span>
				</v-btn>
				<v-btn
					icon
					variant="flat"
					@click="playNow"
					v-if="store.state.room.queueMode !== QueueMode.Vote"
					data-cy="btn-play-now"
				>
					<v-icon>fa:fas fa-play</v-icon>
					<v-tooltip activator="parent" location="top">
						<span>{{ $t("video.playnow-explanation") }}</span>
					</v-tooltip>
				</v-btn>
				<v-btn
					icon
					variant="flat"
					:loading="isLoadingAdd"
					@click="addToQueue"
					v-if="isPreview && store.state.room.queueMode !== QueueMode.Dj"
					data-cy="btn-add-to-queue"
				>
					<v-icon v-if="hasError">fa:fas fa-exclamation</v-icon>
					<v-icon v-else-if="hasBeenAdded">fa:fas fa-check</v-icon>
					<v-icon v-else>fa:fas fa-plus</v-icon>
					<v-tooltip activator="parent" location="top">
						<span>{{ $t("video.add-explanation") }}</span>
					</v-tooltip>
				</v-btn>

				<v-btn
					icon
					variant="flat"
					:loading="isLoadingAdd"
					v-if="!isPreview && store.state.room.queueMode !== QueueMode.Dj"
					@click="removeFromQueue"
					data-cy="btn-remove-from-queue"
				>
					<v-icon v-if="hasError">fa:fas fa-exclamation</v-icon>
					<v-icon v-else>fa:fas fa-trash</v-icon>
				</v-btn>
				<v-menu offset-y>
					<template v-slot:activator="{ props }">
						<v-btn icon variant="flat" v-bind="props" data-cy="btn-menu">
							<v-icon>fa:fas fa-ellipsis-v</v-icon>
						</v-btn>
					</template>
					<v-list>
						<v-list-item
							class="button-with-icon"
							@click="playNow"
							v-if="store.state.room.queueMode !== QueueMode.Vote"
							data-cy="menu-btn-play-now"
						>
							<v-icon>fa:fas fa-play</v-icon>
							<span>{{ $t("video.playnow") }}</span>
						</v-list-item>
						<v-list-item
							class="button-with-icon"
							@click="moveToTop"
							v-if="
								!isPreview &&
								store.state.room.queueMode !== QueueMode.Vote &&
								store.state.room.queueMode !== QueueMode.Dj
							"
							data-cy="menu-btn-move-to-top"
						>
							<v-icon>fa:fas fa-sort-amount-up</v-icon>
							<span>{{ $t("video-queue-item.play-next") }}</span>
						</v-list-item>
						<v-list-item
							class="button-with-icon"
							@click="moveToBottom"
							v-if="!isPreview && store.state.room.queueMode !== QueueMode.Vote"
							data-cy="menu-btn-move-to-bottom"
						>
							<v-icon>fa:fas fa-sort-amount-down-alt</v-icon>
							<span>{{ $t("video-queue-item.play-last") }}</span>
						</v-list-item>
						<v-list-item
							:loading="isLoadingAdd"
							v-if="isPreview && store.state.room.queueMode === QueueMode.Dj"
							@click="addToQueue"
							data-cy="menu-btn-add-to-queue"
						>
							<v-icon v-if="hasError">fas fa-exclamation</v-icon>
							<v-icon v-else-if="hasBeenAdded">fa:fas fa-check</v-icon>
							<v-icon v-else>fa:fas fa-plus</v-icon>
							<span>{{ $t("common.add") }}</span>
						</v-list-item>
						<v-list-item
							class="button-with-icon"
							@click="removeFromQueue"
							v-if="!isPreview && store.state.room.queueMode === QueueMode.Dj"
							data-cy="menu-btn-remove-from-queue"
						>
							<v-icon>fa:fas fa-trash</v-icon>
							<span>{{ $t("common.remove") }}</span>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>
	</v-sheet>
</template>

<script lang="ts">
import { defineComponent, ref, toRefs, computed, watchEffect, PropType } from "vue";
import { API } from "@/common-http";
import { secondsToTimestamp } from "@/util/timestamp";
import { ToastStyle } from "@/models/toast";
import { QueueItem, VideoId } from "ott-common/models/video";
import { QueueMode } from "ott-common/models/types";
import { useStore } from "@/store";
import toast from "@/util/toast";
import placeholderUrl from "@/assets/placeholder.svg";
import { useI18n } from "vue-i18n";
import axios, { type AxiosResponse } from "axios";
import { useRoomApi } from "@/util/roomapi";
import { useConnection } from "@/plugins/connection";
import type { OttResponseBody } from "ott-common/models/rest-api";

interface VideoQueueItemProps {
	item: QueueItem;
	isPreview: boolean;
	hideAllButtons: boolean;
	index: number;
}

const VideoQueueItem = defineComponent({
	name: "VideoQueueItem",
	props: {
		item: { type: Object as PropType<QueueItem>, required: true },
		isPreview: { type: Boolean, default: false },
		hideAllButtons: { type: Boolean, default: false },
		index: { type: Number, required: false },
	},
	setup(props: VideoQueueItemProps) {
		const { item, index } = toRefs(props);
		const store = useStore();
		const { t } = useI18n();
		const roomapi = useRoomApi(useConnection());

		const isLoadingAdd = ref(false);
		const isLoadingVote = ref(false);
		const hasBeenAdded = ref(false);
		const thumbnailHasError = ref(false);
		const hasError = ref(false);
		const voted = ref(false);

		const videoLength = computed(() => secondsToTimestamp(item.value?.length ?? 0));
		const videoStartAt = computed(() => secondsToTimestamp(item.value?.startAt ?? 0));
		const thumbnailSource = computed(() => {
			return !thumbnailHasError.value && item.value.thumbnail
				? item.value.thumbnail
				: placeholderUrl;
		});
		const votes = computed(() => {
			const store = useStore();
			return store.state.room.voteCounts?.get(item.value.service + item.value.id) ?? 0;
		});

		function updateHasBeenAdded() {
			if (
				store.state.room.currentSource &&
				item.value.id === store.state.room.currentSource.id &&
				item.value.service === store.state.room.currentSource.service
			) {
				hasBeenAdded.value = true;
				return;
			}
			for (const video of store.state.room.queue) {
				if (item.value.id === video.id && item.value.service === video.service) {
					hasBeenAdded.value = true;
					return;
				}
			}
			hasBeenAdded.value = false;
		}

		function getPostData(): VideoId {
			const data = {
				service: item.value.service,
				id: item.value.id,
			};
			return data;
		}

		async function addToQueue() {
			isLoadingAdd.value = true;
			try {
				const resp = await API.post(`/room/${store.state.room.name}/queue`, getPostData());
				hasError.value = !resp.data.success;
				hasBeenAdded.value = true;
				toast.add({
					style: ToastStyle.Success,
					content: t("video-queue-item.messages.video-added").toString(),
					duration: 5000,
				});
			} catch (e) {
				hasError.value = true;
				if (axios.isAxiosError(e)) {
					toast.add({
						style: ToastStyle.Error,
						content: e.response?.data.error.message,
						duration: 6000,
					});
				}
			}
			isLoadingAdd.value = false;
		}

		async function removeFromQueue() {
			isLoadingAdd.value = true;
			try {
				const resp = await API.delete(`/room/${store.state.room.name}/queue`, {
					data: getPostData(),
				});
				hasError.value = !resp.data.success;
				toast.add({
					style: ToastStyle.Success,
					content: t("video-queue-item.messages.video-removed").toString(),
					duration: 5000,
				});
			} catch (e) {
				hasError.value = true;
				if (axios.isAxiosError(e)) {
					toast.add({
						style: ToastStyle.Error,
						content: e.response?.data.error.message,
						duration: 6000,
					});
				}
			}
			isLoadingAdd.value = false;
		}

		async function vote() {
			isLoadingVote.value = true;
			try {
				let resp: AxiosResponse<OttResponseBody>;
				if (!voted.value) {
					resp = await API.post(`/room/${store.state.room.name}/vote`, getPostData());
					voted.value = true;
				} else {
					resp = await API.delete(`/room/${store.state.room.name}/vote`, {
						data: getPostData(),
					});
					voted.value = false;
				}
				hasError.value = !resp.data.success;
			} catch (e) {
				hasError.value = true;
				toast.add({
					style: ToastStyle.Error,
					content: e.response.data.error.message,
					duration: 6000,
				});
			}
			isLoadingVote.value = false;
		}

		function playNow() {
			roomapi.playNow(item.value);
		}

		/**
		 * Moves the video to the top of the queue.
		 */
		function moveToTop() {
			roomapi.queueMove(index.value, 0);
		}

		/**
		 * Moves the video to the bottom of the queue.
		 */
		function moveToBottom() {
			roomapi.queueMove(index.value, store.state.room.queue.length - 1);
		}

		function onThumbnailError() {
			thumbnailHasError.value = true;
		}

		watchEffect(() => {
			updateHasBeenAdded();
		});

		return {
			isLoadingAdd,
			isLoadingVote,
			hasBeenAdded,
			thumbnailHasError,
			hasError,
			voted,

			videoLength,
			videoStartAt,
			thumbnailSource,
			votes,

			addToQueue,
			removeFromQueue,
			vote,
			playNow,
			moveToTop,
			moveToBottom,
			onThumbnailError,
			getPostData,

			QueueMode,
			store,
			placeholderUrl,
		};
	},
});

export default VideoQueueItem;
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.video {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: stretch;
	justify-content: space-between;
	width: 100%;
	max-height: 111px;

	> * {
		display: flex;
	}

	.meta-container {
		flex-grow: 1;
		margin: 0 10px;

		> div {
			flex-direction: column;
			width: 100%;
		}
		min-width: 20%;
		width: 30%;

		.video-title,
		.experimental {
			font-size: 1.25rem;
			@media (max-width: $sm-max) {
				font-size: 0.8rem;
			}
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.description {
			flex-grow: 1;
			font-size: 0.9rem;
			overflow: hidden;
			text-overflow: ellipsis;

			@media (max-width: $sm-max) {
				display: none;
			}
		}
	}

	.img-container {
		width: 200px;
		max-width: 200px;
		@media (max-width: $sm-max) {
			max-width: 80px;
		}
	}

	.button-container {
		flex-direction: row;
		justify-content: center;
		flex-wrap: nowrap;

		@media (max-width: $sm-max) {
			.vote-text {
				display: none;
			}
		}

		> button {
			margin: 0 5px;
		}
	}

	.drag-handle {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 40%;
		height: 100.5%;
		background: linear-gradient(
			90deg,
			rgba(0, 0, 0, 0.8) 0%,
			rgba(0, 0, 0, 0.7) 40%,
			rgba(0, 0, 0, 0) 100%
		);
		cursor: move;

		opacity: 0;

		transition: all 0.4s ease;

		* {
			position: absolute;
			top: 50%;
			left: 12px;
			transform: translateY(-50%);
		}
	}

	&:hover {
		.drag-handle {
			opacity: 1;
		}
	}
}

.button-with-icon {
	.v-icon {
		font-size: 18px;
		margin: 0 5px;
	}
}

.video-length {
	background: rgba(0, 0, 0, 0.8);
	padding: 2px 5px;
	border-top-left-radius: 3px;
	position: absolute;
	bottom: 0;
	right: 0;
	z-index: 1000;
}

.video-start-at {
	font-size: 1rem;
	@media (max-width: $sm-max) {
		font-size: 0.8rem;
	}
	font-style: italic;
}
</style>
