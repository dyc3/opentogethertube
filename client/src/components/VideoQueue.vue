<template>
	<div class="video-queue">
		<div class="empty-queue" v-if="$store.state.room.queue.length === 0">
			<v-container style="height: 100%">
				<v-row justify="center" align="center" style="height: 100%">
					<div>
						<div class="msg">
							{{ $t("video-queue.no-videos") }}
						</div>
						<v-btn size="x-large" block @click="$emit('switchtab')">
							<v-icon style="margin-right: 8px">fas fa-plus</v-icon>
							{{ $t("video-queue.add-video") }}
						</v-btn>
					</div>
				</v-row>
			</v-container>
		</div>
		<div class="queue-controls" v-if="$store.state.room.queue.length > 0">
			<v-btn icon @click="api.shuffle()">
				<v-icon>fas fa-random</v-icon>
			</v-btn>
		</div>
		<draggable
			tag="transition-group"
			:component-data="{ name: 'video-queue' }"
			v-model="$store.state.room.queue"
			:move="() => granted('manage-queue.order')"
			@end="onQueueDragDrop"
			handle=".drag-handle"
			item-key="id"
		>
			<template #item="itemdata">
				<VideoQueueItem :key="itemdata.id" :item="itemdata" />
			</template>
		</draggable>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import draggable from "vuedraggable";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import api from "@/util/api";
import { granted } from "@/util/grants";

function onQueueDragDrop(e: { oldIndex: number; newIndex: number }) {
	api.queueMove(e.oldIndex, e.newIndex);
}

const VideoQueue = defineComponent({
	name: "VideoQueue",
	components: {
		draggable,
		VideoQueueItem,
	},
	setup() {
		return {
			onQueueDragDrop,

			api,
			granted,
		};
	},
});

export default VideoQueue;
</script>

<style lang="scss" scoped>
.video-queue {
	margin: 0 10px;
	min-height: 500px;
}

.empty-queue {
	height: 300px;

	.msg {
		opacity: 0.5;
		font-size: 20px;
	}
}

.queue-controls {
	margin-top: 6px;
}

// Transition animation
.video-queue-enter-active,
.video-queue-leave-active {
	transition: all 0.2s;
}
.video-queue-enter,
.video-queue.leave-to {
	opacity: 0;
	transform: translateX(-30px) scaleY(0);
}
.video-queue-move {
	transition: transform 0.2s;
}
</style>
