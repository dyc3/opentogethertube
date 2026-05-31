<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

/** Marquee projector spinner — replaces <v-progress-circular indeterminate />. */
const props = defineProps<{
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<span
		role="status"
		aria-label="loading"
		:class="
			cn(
				'inline-block size-6 rounded-full border-2 border-current/25 border-t-current align-middle',
				props.class,
			)
		"
		:style="{ animation: 'ott-spin 0.7s linear infinite' }"
	></span>
</template>
