<template>
	<v-card :key="item" style="margin-top: 10px">
		<v-card-title>{{ item.id }}</v-card-title>
		<v-card-text>{{ item.service }} {{ item.length }}</v-card-text>
		<v-card-text>{{ item }}</v-card-text>
		<v-btn icon @click="removeFromQueue">
			<v-icon>fas fa-trash</v-icon>
		</v-btn>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: "VideoQueueItem",
	props: {
		item: Object
	},
	methods: {
		removeFromQueue() {
			let data = {
				service: this.item.service,
				id: this.item.id,
			};
			API.delete(`/room/${this.$route.params.roomId}/queue`, { data: data }).then(res => {
				console.log(`Remove ${data} from queue:`, res.data);
			});
		}
	}
}
</script>