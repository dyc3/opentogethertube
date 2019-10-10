<template>
	<v-card class="video" style="margin-top: 10px" hover>
		<v-container class="pa-0">
			<v-row no-gutters align="center" justify="space-between">
				<v-col cols="4">
					<v-img :src="item.thumbnail" contain>
						<span class="length">{{ videoLength }}</span>
					</v-img>
				</v-col>
				<v-col cols="7">
					<v-container>
						<v-row class="title" no-gutters>{{ item.title }}</v-row>
						<v-row class="description" no-gutters>{{ item.description }}</v-row>
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
.title {
	@media screen and (max-width: 960px) {
		font-size: 10px !important;
	}
	@media screen and (min-width: 960px) and  (max-width: 1264px) {
		font-size: 12px !important;
	}
	@media screen and (min-width: 1264px) {
		font-size: 20px !important;
	}
	overflow: hidden;
	text-overflow: ellipsis;
}
.description {
	font-size: 11px;
	line-height: 1;
	overflow-y: hidden;
	text-overflow: ellipsis;
	height: 100px;

	@media screen and (max-width: 1264px) {
		display: none;
	}
}
.length {
	color: #fff;
	background: rgba(0, 0, 0, 0.8);
	padding: 2px 5px;
	border-radius: 3px;
	position: absolute;
	bottom: 0;
	right: 0;
	z-index: 1000;
}
</style>
