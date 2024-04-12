<script lang="ts" setup>
import { onUnmounted } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";
import { PlayerStatus } from "ott-common/models/types";
import _ from "lodash";

const store = useStore();
const connection = useConnection();

const playbackStatusUnsub = store.subscribe((mutation, state) => {
	if (mutation.type === "PLAYBACK_STATUS" && state.playerStatus !== mutation.payload) {
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
</script>
