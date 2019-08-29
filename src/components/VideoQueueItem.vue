<template>
	<v-card style="margin-top: 10px">
		<v-list-item three-line>
			<v-list-item-avatar tile size="125">
				<v-img :src="item.thumbnail"></v-img>
			</v-list-item-avatar>
			<v-list-item-content>
				<v-card-title>{{ item.title }}</v-card-title>
				<v-card-text>
					{{ item.service }} {{ item.length }}<br>
					{{ item.description }}
				</v-card-text>
				<v-card-actions>
					<v-btn icon @click="removeFromQueue" v-if="!isPreview">
						<v-icon>fas fa-trash</v-icon>
					</v-btn>
				</v-card-actions>
			</v-list-item-content>
		</v-list-item>
	</v-card>
</template>

<script>
import { API } from "@/common-http.js";

export default {
	name: "VideoQueueItem",
	props: {
		item: { type: Object, required: true },
		isPreview: { type: Boolean, default: false }
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