<template>
	<v-card class="mt-2 video" hover>
		<v-container class="pa-0">
			<v-row no-gutters align="center" justify="space-between">
				<v-col cols="4">
					<v-img :src="item.thumbnail" contain>
						<span class="drag-handle">
							<v-icon>fas fa-align-justify</v-icon>
						</span>
						<span class="subtitle-2 video-length">{{ videoLength }}</span>
					</v-img>
				</v-col>
				<v-col cols="6">
					<v-container>
						<v-row class="title" no-gutters>{{ item.title }}</v-row>
						<v-row class="body-1 text-truncate" no-gutters>{{ item.description }}</v-row>
					</v-container>
				</v-col>
				<v-col cols="1">
					<v-btn icon small :loading="isLoading" v-if="isPreview" @click="addToQueue">
						<v-icon v-if="hasBeenAdded">fas fa-check</v-icon>
						<v-icon v-else>fas fa-plus</v-icon>
					</v-btn>
					<v-btn icon small :loading="isLoading" v-else @click="removeFromQueue">
						<v-icon>fas fa-trash</v-icon>
					</v-btn>
				</v-col>
			</v-row>
		</v-container>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";
import secondsToTimestamp from "@/timestamp.js";

export default {
	name: "VideoQueueItem",
	props: {
		item: { type: Object, required: true },
		isPreview: { type: Boolean, default: false },
	},
	data() {
		return {
			isLoading: false,
			hasBeenAdded: false,
		};
	},
	computed:{
		videoLength() {
			return secondsToTimestamp(this.item.length);
		},
	},
	methods: {
		addToQueue() {
			this.isLoading = true;
			API.post(`/room/${this.$route.params.roomId}/queue`, {
				service: this.item.service,
				id: this.item.id,
			}).then(() => {
				this.isLoading = false;
				this.hasBeenAdded = true;
			});
		},
		removeFromQueue() {
			this.isLoading = true;
			API.delete(`/room/${this.$route.params.roomId}/queue`, {
				data: {
					service: this.item.service,
					id: this.item.id,
				},
			}).then(() => {
				this.isLoading = false;
			});
		},
	},
};
</script>

<style lang="scss" scoped>
.video {
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
