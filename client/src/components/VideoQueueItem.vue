<template>
	<v-sheet class="mt-2 video" hover>
		<div class="img-container">
			<v-img :src="thumbnailSource" :lazy-src="require('@/assets/placeholder.svg')" aspect-ratio="1.8" @error="onThumbnailError">
				<span class="drag-handle" v-if="!isPreview && $store.state.room.queueMode !== QueueMode.Vote">
					<v-icon>fas fa-align-justify</v-icon>
				</span>
				<span class="video-length">{{ videoLength }}</span>
			</v-img>
		</div>
		<div class="meta-container">
			<div>
				<div class="video-title" no-gutters>{{ item.title }}</div>
				<div class="description text-truncate" no-gutters>{{ item.description }}</div>
				<div v-if="item.service === 'googledrive'" class="experimental">{{ $t("video-queue-item.experimental") }}</div>
			</div>
		</div>
		<div class="d-flex" style="justify-content: center; flex-direction: column">
			<div class="button-container">
				<v-btn class="button-with-icon" @click="vote" :loading="isLoadingVote" :color="voted ? 'red' : 'green'" v-if="!isPreview && $store.state.room.queueMode === QueueMode.Vote">
					<span>{{ votes }}</span>
					<v-icon>fas fa-thumbs-up</v-icon>
					<span class="vote-text">{{ item.voted ? "Unvote" : "Vote" }}</span>
				</v-btn>
				<v-tooltip top>
					<template v-slot:activator="{ on, attrs }">
						<v-btn
							icon
							@click="playNow"
							v-on="on"
							v-bind="attrs"
							v-if="$store.state.room.queueMode !== QueueMode.Vote"
						>
							<v-icon>fas fa-play</v-icon>
						</v-btn>
					</template>
					<span>{{ $t("video.playnow-explanation") }}</span>
				</v-tooltip>
				<v-tooltip top>
					<template v-slot:activator="{ on, attrs }">
						<v-btn
							icon
							:loading="isLoadingAdd"
							@click="addToQueue"
							v-on="on"
							v-bind="attrs"
							v-if="isPreview && $store.state.room.queueMode !== QueueMode.Dj"
						>
							<v-icon v-if="hasError">fas fa-exclamation</v-icon>
							<v-icon v-else-if="hasBeenAdded">fas fa-check</v-icon>
							<v-icon v-else>fas fa-plus</v-icon>
						</v-btn>
					</template>
					<span>{{ $t("video.add-explanation") }}</span>
				</v-tooltip>

				<v-btn icon :loading="isLoadingAdd" v-if="!isPreview && $store.state.room.queueMode !== QueueMode.Dj" @click="removeFromQueue">
					<v-icon v-if="hasError">fas fa-exclamation</v-icon>
					<v-icon v-else>fas fa-trash</v-icon>
				</v-btn>
				<v-menu offset-y>
					<template v-slot:activator="{ on, attrs }">
						<v-btn icon v-bind="attrs" v-on="on">
							<v-icon>fas fa-ellipsis-v</v-icon>
						</v-btn>
					</template>
					<v-list>
						<v-list-item class="button-with-icon" @click="playNow" v-if="$store.state.room.queueMode !== QueueMode.Vote">
							<v-icon>fas fa-play</v-icon>
							<span>{{ $t("video.playnow") }}</span>
						</v-list-item>
						<v-list-item class="button-with-icon" @click="moveToTop" v-if="!isPreview && $store.state.room.queueMode !== QueueMode.Vote && $store.state.room.queueMode !== QueueMode.Dj">
							<v-icon>fas fa-sort-amount-up</v-icon>
							<span>{{ $t("video-queue-item.play-next") }}</span>
						</v-list-item>
						<v-list-item class="button-with-icon" @click="moveToBottom" v-if="!isPreview && $store.state.room.queueMode !== QueueMode.Vote">
							<v-icon>fas fa-sort-amount-down-alt</v-icon>
							<span>{{ $t("video-queue-item.play-last") }}</span>
						</v-list-item>
						<v-btn icon :loading="isLoadingAdd" v-if="isPreview && $store.state.room.queueMode === QueueMode.Dj" @click="addToQueue">
							<v-icon v-if="hasError">fas fa-exclamation</v-icon>
							<v-icon v-else-if="hasBeenAdded">fas fa-check</v-icon>
							<v-icon v-else>fas fa-plus</v-icon>
							<span>{{ $t("video-queue-item.add") }}</span>
						</v-btn>
						<v-list-item class="button-with-icon" @click="removeFromQueue" v-if="!isPreview && $store.state.room.queueMode === QueueMode.Dj">
							<v-icon>fas fa-trash</v-icon>
							<span>{{ $t("video-queue-item.remove") }}</span>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>
	</v-sheet>
</template>

<script lang="ts">
import Vue from "vue";
import { API } from "@/common-http.js";
import { secondsToTimestamp } from "@/util/timestamp";
import { ToastStyle } from '@/models/toast';
import Component from 'vue-class-component';
import { Video, VideoId } from "common/models/video";
import { QueueMode } from "common/models/types";
import api from "@/util/api";

@Component({
	name: "VideoQueueItem",
	props: {
		item: { type: Object, required: true },
		isPreview: { type: Boolean, default: false },
		index: { type: Number, required: false },
	},
})
export default class VideoQueueItem extends Vue {
	item: Video
	isPreview: boolean
	index: number

	isLoadingAdd = false
	isLoadingVote = false
	hasBeenAdded = false
	thumbnailHasError = false
	hasError = false
	voted = false
	QueueMode = QueueMode

	get videoLength(): string {
		return secondsToTimestamp(this.item?.length ?? 0);
	}

	get thumbnailSource(): string {
		return !this.thumbnailHasError && this.item.thumbnail ? this.item.thumbnail : require('@/assets/placeholder.svg');
	}

	get votes() {
		return this.$store.state.room.voteCounts?.get(this.item.service + this.item.id) ?? 0;
	}

	created() {
		if (this.item.id === this.$store.state.room.currentSource.id && this.item.service === this.$store.state.room.currentSource.service) {
			this.hasBeenAdded = true;
			return;
		}
		for (let video of this.$store.state.room.queue) {
			if (this.item.id === video.id && this.item.service === video.service) {
				this.hasBeenAdded = true;
				return;
			}
		}
	}

	getPostData(): VideoId {
		let data = {
			service: this.item.service,
			id: this.item.id,
		};
		// console.log(data);
		return data;
	}

	async addToQueue() {
		this.isLoadingAdd = true;
		try {
			let resp = await API.post(`/room/${this.$route.params.roomId}/queue`, this.getPostData());
			this.hasError = !resp.data.success;
			this.hasBeenAdded = true;
			this.$toast.add({
				style: ToastStyle.Success,
				content: this.$t('video-queue-item.messages.video-added') as string,
				duration: 5000,
			});
		}
		catch (e) {
			this.hasError = true;
			this.$toast.add({
				style: ToastStyle.Error,
				content: e.response.data.error.message,
				duration: 6000,
			});
		}
		this.isLoadingAdd = false;
	}

	async removeFromQueue() {
		this.isLoadingAdd = true;
		try {
			let resp = await API.delete(`/room/${this.$route.params.roomId}/queue`, {
				data: this.getPostData(),
			});
			this.hasError = !resp.data.success;
			this.$toast.add({
				style: ToastStyle.Success,
				content: this.$t('video-queue-item.messages.video-removed') as string,
				duration: 5000,
			});
		}
		catch (e) {
			this.hasError = true;
			this.$toast.add({
				style: ToastStyle.Error,
				content: e.response.data.error.message,
				duration: 6000,
			});
		}
		this.isLoadingAdd = false;
	}

	async vote() {
		this.isLoadingVote = true;
		try {
			let resp;
			if (!this.voted) {
				resp = await API.post(`/room/${this.$route.params.roomId}/vote`, this.getPostData());
				this.voted = true;
			}
			else {
				resp = await API.delete(`/room/${this.$route.params.roomId}/vote`, { data: this.getPostData() });
				this.voted = false;
			}
			this.hasError = !resp.data.success;
		}
		catch (e) {
			this.hasError = true;
			this.$toast.add({
				style: ToastStyle.Error,
				content: e.response.data.error.message,
				duration: 6000,
			});
		}
		this.isLoadingVote = false;

	}

	playNow() {
		api.playNow(this.item);
	}

	/**
	 * Moves the video to the top of the queue.
	 */
	moveToTop() {
		api.queueMove(this.index, 0);
	}

	/**
	 * Moves the video to the bottom of the queue.
	 */
	moveToBottom() {
		api.queueMove(this.index, this.$store.state.room.queue.length - 1);
	}

	onThumbnailError() {
		this.thumbnailHasError = true;
	}
}
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

		.video-title, .experimental {
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
		background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0) 100%);

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
</style>
