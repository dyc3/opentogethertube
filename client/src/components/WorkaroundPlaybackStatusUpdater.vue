<template>
	<span></span>
</template>

<script lang="ts">
import { defineComponent, onUnmounted } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";
import { PlayerStatus } from "ott-common/models/types";
import _ from "lodash";

export const WorkaroundPlaybackStatusUpdater = defineComponent({
	name: "WorkaroundPlaybackStatusUpdater",
	setup() {
		const store = useStore();
		const connection = useConnection();

		const playbackStatusUnsub = store.subscribe(mutation => {
			if (mutation.type === "PLAYBACK_STATUS") {
				sendPlaybackStatusDebounced(mutation.payload);
			}
		});

		function sendPlaybackStatus(status: PlayerStatus) {
			connection.send({
				action: "status",
				status: status,
			});
		}

		const sendPlaybackStatusDebounced = _.debounce(sendPlaybackStatus, 200, { maxWait: 500 });

		onUnmounted(() => {
			playbackStatusUnsub();
		});

		return {};
	},
});

export default WorkaroundPlaybackStatusUpdater;
</script>
