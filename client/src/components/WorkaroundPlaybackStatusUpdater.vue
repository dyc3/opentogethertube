<template>
	<span></span>
</template>

<script lang="ts">
import { defineComponent, onUnmounted } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";

export const WorkaroundPlaybackStatusUpdater = defineComponent({
	name: "WorkaroundPlaybackStatusUpdater",
	setup() {
		const store = useStore();
		const connection = useConnection();

		const playbackStatusUnsub = store.subscribe(mutation => {
			if (mutation.type === "PLAYBACK_STATUS") {
				connection.send({
					action: "status",
					status: mutation.payload,
				});
			}
		});

		onUnmounted(() => {
			playbackStatusUnsub();
		});

		return {};
	},
});

export default WorkaroundPlaybackStatusUpdater;
</script>
