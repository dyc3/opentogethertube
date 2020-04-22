<template>
	<v-sheet class="mt-2 video" hover>
		<div class="img-container">
			<v-img :src="thumbnailSource" :lazy-src="require('@/assets/placeholder.svg')" :style="{ height: item.thumbnail ? null : 320 + 'px' }" aspect-ratio="1.8" @error="onThumbnailError">
				<span class="drag-handle" v-if="!isPreview && $store.state.room.queueMode === 'manual'">
					<v-icon>fas fa-align-justify</v-icon>
				</span>
				<span class="video-length">{{ videoLength }}</span>
			</v-img>
		</div>
		<div class="meta-container">
			<div>
				<div class="video-title" no-gutters>{{ item.title }}</div>
				<div class="description text-truncate" no-gutters>{{ item.description }}</div>
				<div v-if="item.service === 'googledrive'" class="experimental">Experimental support for this service! Expect it to break a lot.</div>
			</div>
		</div>
		<div style="display: flex; justify-content: center; flex-direction: column">
			<div class="button-container">
				<v-btn @click="vote" :loading="isLoadingVote" :color="item.voted ? 'red' : 'green'" v-if="!isPreview && $store.state.room.queueMode === 'vote'">
					<span>{{ item.votes ? item.votes : 0 }}</span>
					<v-icon style="font-size: 18px; margin: 0 4px">fas fa-thumbs-up</v-icon>
					<span class="vote-text">{{ item.voted ? "Unvote" : "Vote" }}</span>
				</v-btn>
				<v-btn icon :loading="isLoadingAdd" v-if="isPreview" @click="addToQueue">
					<v-icon v-if="hasBeenAdded">fas fa-check</v-icon>
					<v-icon v-else>fas fa-plus</v-icon>
				</v-btn>
				<v-btn icon :loading="isLoadingAdd" v-else @click="removeFromQueue">
					<v-icon>fas fa-trash</v-icon>
				</v-btn>
			</div>
		</div>
	</v-sheet>
</template>

<script>
import { API } from "@/common-http.js";
import { secondsToTimestamp } from "@/timestamp.js";

export default {
	name: "VideoQueueItem",
	props: {
		item: { type: Object, required: true },
		isPreview: { type: Boolean, default: false },
	},
	data() {
		return {
			isLoadingAdd: false,
			isLoadingVote: false,
			hasBeenAdded: false,
			thumbnailHasError: false,
		};
	},
	computed:{
		videoLength() {
			return secondsToTimestamp(this.item.length);
		},
		thumbnailSource() {
			return !this.thumbnailHasError && this.item.thumbnail ? this.item.thumbnail : require('@/assets/placeholder.svg');
		},
	},
	methods: {
		addToQueue() {
			this.isLoadingAdd = true;
			API.post(`/room/${this.$route.params.roomId}/queue`, {
				service: this.item.service,
				id: this.item.id,
			}).then(() => {
				this.isLoadingAdd = false;
				this.hasBeenAdded = true;
			});
		},
		removeFromQueue() {
			this.isLoadingAdd = true;
			API.delete(`/room/${this.$route.params.roomId}/queue`, {
				data: {
					service: this.item.service,
					id: this.item.id,
				},
			}).then(() => {
				this.isLoadingAdd = false;
			});
		},
		vote() {
			this.isLoadingVote = true;
			if (!this.item.voted) {
				API.post(`/room/${this.$route.params.roomId}/vote`, {
					service: this.item.service,
					id: this.item.id,
				}).then(() => {
					this.isLoadingVote = false;
					this.item.voted = true;
				});
			}
			else {
				API.delete(`/room/${this.$route.params.roomId}/vote`, { data: {
					service: this.item.service,
					id: this.item.id,
				}}).then(() => {
					this.isLoadingVote = false;
					this.item.voted = false;
				});
			}
		},
		onThumbnailError() {
			this.thumbnailHasError = true;
		},
	},
};
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
