<template>
	<Transition name="restore">
		<v-banner
			class="restore"
			color="primary"
			:text="$t('video-queue.restore')"
			:stacked="false"
			v-if="!!store.state.prevQueue"
		>
			<template v-slot:actions>
				<v-btn color="primary" @click="restore">{{ $t("common.show") }}</v-btn>
				<v-btn color="default" @click="discard">{{ $t("common.discard") }}</v-btn>
			</template>
		</v-banner>
	</Transition>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useStore } from "../store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";

export default defineComponent({
	name: "RestoreQueue",
	setup() {
		const store = useStore();
		const connection = useConnection();
		const roomapi = useRoomApi(connection);

		function restore() {
			roomapi.restoreQueue();
		}

		function discard() {
			roomapi.restoreQueue({ discard: true });
		}

		return {
			store,

			restore,
			discard,
		};
	},
});
</script>

<style lang="scss">
.restore-enter-active,
.restore-leave-active {
	transition: all 0.5s;
}

.restore-enter,
.restore-leave-to {
	opacity: 0;
	transform: translateY(100%);
}
</style>
