<template>
	<div class="video-queue">
		<div class="empty-queue" v-if="$store.state.room.queue.length === 0">
			<v-container fill-height>
				<v-row justify="center" align="center">
					<div>
						<div class="msg">
							There aren't any videos queued up.
						</div>
						<v-btn x-large block @click="$emit('switchtab')">
							Add a video
						</v-btn>
					</div>
				</v-row>
			</v-container>
		</div>
		<draggable v-model="$store.state.room.queue" :move="() => this.granted('manage-queue.order')" @end="onQueueDragDrop" handle=".drag-handle">
			<transition-group name="video-queue">
				<VideoQueueItem v-for="(itemdata, index) in $store.state.room.queue" :key="itemdata.id" :item="itemdata" :index="index" />
			</transition-group>
		</draggable>
	</div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from 'vue-class-component';
import draggable from 'vuedraggable';
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import api from "@/util/api";
import PermissionsMixin from "@/mixins/permissions.js";

@Component({
	name: "VideoQueue",
	components: {
		draggable,
		VideoQueueItem,
	},
	mixins: [PermissionsMixin],
})
export default class VideoQueue extends Vue {
	onQueueDragDrop(e) {
		api.queueMove(e.oldIndex, e.newIndex);
	}
}
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

// Transition animation
.video-queue-enter-active, .video-queue-leave-active {
  transition: all 0.2s;
}
.video-queue-enter, .video-queue.leave-to {
  opacity: 0;
  transform: translateX(-30px) scaleY(0);
}
.video-queue-move {
  transition: transform 0.2s;
}
</style>
