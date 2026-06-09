<template>
	<div
		:class="{
			message: true,
			recent,
		}"
	>
		<div class="from">{{ msg.from.name }}</div>
		<div class="text">
			<ProcessedText :text="msg.text" @link-click="emit('link-click', $event)" />
		</div>
	</div>
</template>

<script lang="ts" setup>
import ProcessedText from "@/components/ProcessedText.vue";
import type { ChatMessage } from "ott-common";

defineProps<{
	msg: ChatMessage;
	recent?: boolean;
}>();

const emit = defineEmits<{
	"link-click": [e: string];
}>();
</script>

<style lang="scss" scoped>
.message {
	margin: 2px 0;
	padding: 6px 8px;
	opacity: 0;
	transition: all 1s ease;
	border-left: 2px solid transparent;

	&:first-child {
		margin-top: auto;
	}

	&.recent {
		opacity: 1;
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
		border-left-color: color-mix(in srgb, var(--signal) 60%, transparent);
		border-radius: 2px;
	}

	.from,
	.text {
		display: inline;
		margin: 3px 5px;
		word-wrap: break-word;
		overflow-wrap: anywhere;
	}

	.text {
		color: var(--foreground);
	}

	.from {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.8em;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--primary);
		margin-left: 0;
	}

	@media screen and (max-width: 600px) {
		font-size: 0.8em;
	}
}
</style>
