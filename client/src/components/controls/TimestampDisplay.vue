<template>
	<div class="media-control">
		<ClickToEdit v-model="currentPosition" @change="value => roomapi.seek(value)"
			:value-formatter="secondsToTimestamp" :value-parser="timestampToSeconds" />
		<span>/</span>
		<span class="video-length">
			{{ lengthDisplay }}
		</span>
	</div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import { secondsToTimestamp, timestampToSeconds } from "@/util/timestamp";
import ClickToEdit from "../ClickToEdit.vue";

export const TimestampDisplay = defineComponent({
	name: "TimestampDisplay",
	props: {
		currentPosition: {
			type: Number,
			default: 0,
		},
	},
	components: {
		ClickToEdit,
	},
	setup() {
		const store = useStore();
		const roomapi = useRoomApi(useConnection());

		const lengthDisplay = computed(() => {
			const length = store.state.room.currentSource?.length ?? 0;
			return secondsToTimestamp(length);
		});

		return {
			store,
			roomapi,

			lengthDisplay,

			secondsToTimestamp,
			timestampToSeconds,
		};
	},
});

export default TimestampDisplay;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>