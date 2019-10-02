<template>
	<v-card class="video" style="margin-top: 10px" hover>
		<v-card-text style="padding: 0 12px">
			<v-layout row>
				<v-flex lg3 xs4>
					<v-img :src="item.thumbnail">
						<span class="length">{{ videoLength }}</span>
					</v-img>
				</v-flex>
				<v-flex lg9 xs8>
					<v-layout column style="margin-left: 16px">
						<v-flex class="title">
							{{ item.title }}
						</v-flex>
						<v-flex class="description">
							{{ item.description }}
						</v-flex>
						<v-flex class="actions">
							<v-btn icon :loading="isLoading" :small="$vuetify.breakpoint.mdAndUp" :x-small="$vuetify.breakpoint.smAndDown" @click="addToQueue" v-if="isPreview">
								<v-icon v-if="hasBeenAdded">fas fa-check</v-icon>
								<v-icon v-else>fas fa-plus</v-icon>
							</v-btn>
							<v-btn icon :loading="isLoading" :small="$vuetify.breakpoint.mdAndUp" :x-small="$vuetify.breakpoint.smAndDown" @click="removeFromQueue" v-if="!isPreview">
								<v-icon>fas fa-trash</v-icon>
							</v-btn>
						</v-flex>
					</v-layout>
				</v-flex>
			</v-layout>
		</v-card-text>
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
	@media screen and (max-width: 960px) {
		height: 67px;
	}
	@media screen and (min-width: 960px) and (max-width: 1264px) {
		height: 117px;
	}
	@media screen and (min-width: 1264px) {
		height: 175px;
	}
	overflow: hidden;
}
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
.actions {
	margin-left: 4px;
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
