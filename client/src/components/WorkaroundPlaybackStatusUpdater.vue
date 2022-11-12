<script lang="ts">
import { defineComponent } from "vue";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";

export const WorkaroundPlaybackStatusUpdater = defineComponent({
	name: "WorkaroundPlaybackStatusUpdater",
	setup() {
		const store = useStore();
		const connection = useConnection();

		store.subscribe((mutation, state) => {
			if (mutation.type === "PLAYBACK_STATUS") {
				connection.send({
					action: "status",
					status: mutation.payload,
				});
			}
		});

		return {};
	},
});

export default WorkaroundPlaybackStatusUpdater;
</script>
