<template>
	<v-card class="mt-2" hover>
		<v-container class="pa-0">
			<v-row no-gutters align="center" justify="space-between">
				<v-col cols="4">
					<v-img :src="item.thumbnail" contain>
						<span class="subtitle-2 video-length">{{ videoLength }}</span>
					</v-img>
				</v-col>
				<v-col cols="7">
					<v-container>
						<v-row class="title" no-gutters>{{ item.title }}</v-row>
						<v-row class="body-1 text-truncate" no-gutters>{{ item.description }}</v-row>
					</v-container>
				</v-col>
				<v-col cols="1">
					<v-btn icon small v-if="isPreview" @click="addToQueue">
						<v-icon>fas fa-plus</v-icon>
					</v-btn>
					<v-btn icon small v-else @click="removeFromQueue">
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
