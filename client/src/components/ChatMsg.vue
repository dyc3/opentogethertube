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
import { ChatMessage } from "ott-common";
import ProcessedText from "@/components/ProcessedText.vue";

defineProps<{
	msg: ChatMessage;
	recent?: boolean;
}>();

const emit = defineEmits<{
	"link-click": [e: string];
}>();
</script>

<style lang="scss">
@import "../variables.scss";

.message {
	margin: 2px 0;
	padding: 4px;
	opacity: 0;
	transition: all 1s ease;

	&:first-child {
		margin-top: auto;
	}

	&.recent {
		opacity: 1;
		background: rgba(var(--v-theme-background), $alpha: 0.6);
	}

	.from,
	.text {
		display: inline;
		margin: 3px 5px;
		word-wrap: break-word;
		overflow-wrap: anywhere;
	}

	.from {
		font-weight: bold;
		margin-left: 0;
	}

	@media screen and (max-width: $sm-max) {
		font-size: 0.8em;
	}
}
</style>
