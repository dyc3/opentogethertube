<template>
	<div class="media-control">
		<ClickToEdit
			:model-value="currentPosition"
			@change="value => roomapi.seek(value)"
			:value-formatter="secondsToTimestamp"
			:value-parser="timestampToSeconds"
		/>
		<span>/</span>
		<span class="video-length">
			{{ lengthDisplay }}
		</span>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";
import { useRoomApi } from "@/util/roomapi";
import { secondsToTimestamp, timestampToSeconds } from "@/util/timestamp";
import ClickToEdit from "../ClickToEdit.vue";

withDefaults(
	defineProps<{
		currentPosition: number;
	}>(),
	{
		currentPosition: 0,
	}
);

const store = useStore();
const roomapi = useRoomApi(useConnection());

const lengthDisplay = computed(() => {
	const length = store.state.room.currentSource?.length ?? 0;
	return secondsToTimestamp(length);
});
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
