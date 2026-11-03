<template>
	<div
		:class="{
			message: true,
			recent,
		}"
	>
		<time v-if="msg.sentAt" class="time" :datetime="isoTime" :title="fullTime">{{
			shortTime
		}}</time>
		<div class="from">{{ msg.from.name }}</div>
		<div class="text">
			<ProcessedText :text="msg.text" @link-click="emit('link-click', $event)" />
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ProcessedText from "@/components/ProcessedText.vue";
import type { ChatMessage } from "ott-common";

const props = defineProps<{
	msg: ChatMessage;
	recent?: boolean;
}>();

const { locale } = useI18n();

const isoTime = computed(() => new Date(props.msg.sentAt).toISOString());
const shortTime = computed(() =>
	new Intl.DateTimeFormat(locale.value, { hour: "numeric", minute: "2-digit" }).format(
		props.msg.sentAt,
	),
);
const fullTime = computed(() =>
	new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "medium" }).format(
		props.msg.sentAt,
	),
);

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

	.time {
		font-family: var(--font-mono);
		font-size: 0.75em;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
		margin-right: 6px;
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
