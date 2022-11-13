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
							<v-icon style="margin-right: 8px">fa:fas fa-plus</v-icon>
							{{ $t("video-queue.add-video") }}
						</v-btn>
					</div>
				</v-row>
			</v-container>
		</div>
		<div class="queue-controls" v-if="$store.state.room.queue.length > 0">
			<v-btn icon @click="api.shuffle()">
				<v-icon>fa:fas fa-random</v-icon>
			</v-btn>
		</div>
		<Sortable
			:list="$store.state.room.queue"
			:move="() => granted('manage-queue.order')"
			@end="onQueueDragDrop"
			:options="{ animation: 200, handle: '.drag-handle' }"
			item-key="id"
		>
			<template #item="{ element }">
				<VideoQueueItem :key="element.id" :item="element" />
			</template>
		</Sortable>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import api from "@/util/api";
import { granted } from "@/util/grants";
import { useStore } from "@/store";
import { Sortable } from "sortablejs-vue3";

function onQueueDragDrop(e: { oldIndex: number; newIndex: number }) {
	// HACK: For some reason, vuedraggable decided to offset all the indexes by 1? I have no idea why they decided to change this
	api.queueMove(e.oldIndex - 1, e.newIndex - 1);
}

const VideoQueue = defineComponent({
	name: "VideoQueue",
	components: {
		VideoQueueItem,
		Sortable,
	},
	setup() {
		const store = useStore();

		return {
			onQueueDragDrop,

			api,
			granted,
			store,
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
.video-queue-enter-from,
.video-queue-leave-to {
	opacity: 0;
	transform: translateX(-30px) scaleY(0);
}
.video-queue-move {
	transition: transform 0.2s;
}
</style>
