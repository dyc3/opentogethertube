<template>
	<v-card class="video" style="margin-top: 10px" hover>
		<v-card-text style="padding: 0 12px">
			<v-layout row>
				<v-flex md3 sm12>
					<v-img :src="item.thumbnail">
						<span class="length">{{ videoLength }}</span>
					</v-img>
				</v-flex>
				<v-flex md9 sm12>
					<v-layout column style="margin-left: 16px">
						<v-flex class="title">
							{{ item.title }}
						</v-flex>
						<v-flex class="description">
							{{ item.description }}
						</v-flex>
						<v-flex class="actions">
							<v-btn icon small @click="addToQueue" v-if="isPreview">
								<v-icon>fas fa-plus</v-icon>
							</v-btn>
							<v-btn icon small @click="removeFromQueue" v-if="!isPreview">
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
	computed:{
		videoLength() {
			return secondsToTimestamp(this.item.length);
		},
	},
	methods: {
		addToQueue() {
			API.post(`/room/${this.$route.params.roomId}/queue`, {
				url: `http://youtube.com/watch?v=${this.item.id}`,
			});
		},
		removeFromQueue() {
			let data = {
				service: this.item.service,
				id: this.item.id,
			};
			API.delete(`/room/${this.$route.params.roomId}/queue`, { data: data }).then(res => {
				console.log(`Remove ${data} from queue:`, res.data);
			});
		},
	},
};
</script>

<style lang="scss" scoped>
.video {
	height: 175px;
}
.title {
	font-size: 20px;
}
.description {
	font-size: 11px;
	line-height: 1;
	overflow-y: hidden;
	text-overflow: ellipsis;
	height: 100px;
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
