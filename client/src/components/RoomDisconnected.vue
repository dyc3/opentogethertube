<template>
	<v-layout column>
		<h1>{{ $t("connect-overlay.title") }}</h1>
		<span>{{ reasonText() }}</span>
		<v-btn to="/rooms">{{ $t("connect-overlay.find-another") }}</v-btn>
	</v-layout>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useStore } from "@/util/vuex-workaround";
import { i18n } from "@/i18n";

const RoomDisconnected = defineComponent({
	name: "RoomDisconnected",
	setup() {
		const store = useStore();

		function reasonText() {
			if (store.state.connection.disconnected) {
				let reason = store.state.connection.disconnected.reason;
				return i18n.t(`connect-overlay.dc-reasons.${reason}`);
			} else {
				return i18n.t("connect-overlay.dc-reasons.unknown");
			}
		}

		return {
			reasonText,
			store,
		};
	},
});

export default RoomDisconnected;
</script>
