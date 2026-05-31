<template>
	<div>
		<Transition name="banner">
			<div
				v-if="(store.state.room.prevQueue?.length ?? 0) > 0"
				class="restore flex flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:items-center"
			>
				<span class="flex-1 text-foreground">{{ $t("video-queue.restore") }}</span>
				<div class="flex gap-2">
					<Button variant="default" @click="showDialog">{{ $t("common.show") }}</Button>
					<Button variant="ghost" @click="discard">{{ $t("common.discard") }}</Button>
				</div>
			</div>
		</Transition>
		<Dialog v-model:open="showRestorePreview">
			<DialogContent class="max-w-xl sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>{{ $t("video-queue.restore-queue") }}</DialogTitle>
				</DialogHeader>
				<div class="flex flex-col gap-2">
					<div class="text-muted-foreground">{{ $t("video-queue.restore-queue-hint") }}</div>
					<div v-for="video in store.state.room.prevQueue" :key="video.id">
						<VideoQueueItem :item="video" :hide-all-buttons="true" />
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" @click="discard">{{ $t("common.discard") }}</Button>
					<Button variant="default" @click="restore">{{ $t("common.restore") }}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ref } from "vue";
import { useStore } from "../store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import VideoQueueItem from "./VideoQueueItem.vue";

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
</script>

<!-- biome-ignore lint/nursery/useScopedStyles: biome migration -->
<style lang="scss">
@use "./banner-transitions.scss";

.restore {
	margin-top: 10px;
}
</style>
