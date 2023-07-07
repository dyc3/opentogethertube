<template>
	<div class="disconnected">
		<h1>{{ $t("connect-overlay.title") }}</h1>
		<span class="dc-reason">{{ reasonText() }}</span>
		<v-btn to="/rooms">{{ $t("connect-overlay.find-another") }}</v-btn>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { useConnection } from "@/plugins/connection";

const RoomDisconnected = defineComponent({
	name: "RoomDisconnected",
	setup() {
		const store = useStore();
		const { t } = useI18n();
		const connection = useConnection();

		function reasonText() {
			if (connection.kickReason.value) {
				const reason = connection.kickReason.value;
				return t(`connect-overlay.dc-reasons.${reason}`);
			} else {
				return t("connect-overlay.dc-reasons.unknown");
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

<style lang="scss">
.disconnected {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	width: 100%;

	h1 {
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.dc-reason {
		margin-bottom: 1rem;
	}
}
</style>
