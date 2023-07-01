<template>
	<div>
		<Transition name="banner">
			<v-banner
				class="restore"
				color="primary"
				:text="$t('video-queue.restore')"
				:stacked="false"
				lines="one"
				sticky
				v-if="(store.state.room.prevQueue?.length ?? 0) > 0"
			>
				<template v-slot:actions>
					<v-btn color="primary" @click="showDialog">{{ $t("common.show") }}</v-btn>
					<v-btn color="default" @click="discard">{{ $t("common.discard") }}</v-btn>
				</template>
			</v-banner>
		</Transition>
		<v-dialog v-model="showRestorePreview" transition="dialog-bottom-transition" width="auto">
			<v-card>
				<v-card-title>
					{{ $t("video-queue.restore-queue") }}
				</v-card-title>
				<v-card-text>
					<div>{{ $t("video-queue.restore-queue-hint") }}</div>
					<div v-for="video in store.state.room.prevQueue" :key="video.id">
						<VideoQueueItem :item="video" :hide-all-buttons="true" />
					</div>
				</v-card-text>
				<v-card-actions>
					<v-btn color="primary" @click="restore">{{ $t("common.restore") }}</v-btn>
					<v-btn @click="discard">{{ $t("common.discard") }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { useStore } from "../store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import VideoQueueItem from "./VideoQueueItem.vue";

export default defineComponent({
	name: "RestoreQueue",
	components: {
		VideoQueueItem,
	},
	setup() {
		const store = useStore();
		const connection = useConnection();
		const roomapi = useRoomApi(connection);

		const showRestorePreview = ref(false);

		function showDialog() {
			showRestorePreview.value = true;
		}

		function restore() {
			roomapi.restoreQueue();
			showRestorePreview.value = false;
		}

		function discard() {
			roomapi.restoreQueue({ discard: true });
			showRestorePreview.value = false;
		}

		return {
			store,

			showRestorePreview,

			showDialog,
			restore,
			discard,
		};
	},
});
</script>

<style lang="scss">
@import "./banner-transitions.scss";

.restore {
	margin-top: 10px;
}
</style>
