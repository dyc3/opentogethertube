<template>
	<div class="disconnected">
		<h1 class="font-display text-4xl text-primary glow-text-primary">
			{{ $t("connect-overlay.title") }}
		</h1>
		<span class="dc-reason label-mono text-muted-foreground">{{ reasonText() }}</span>
		<Button variant="marquee" as-child>
			<router-link to="/rooms">{{ $t("connect-overlay.find-another") }}</router-link>
		</Button>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { useI18n } from "vue-i18n";
import { useConnection } from "@/plugins/connection";

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
</script>

<style scoped>
.disconnected {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	width: 100%;
	gap: 1rem;
}
</style>
