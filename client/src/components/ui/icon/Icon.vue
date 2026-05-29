<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

/**
 * Renders an MDI icon from an `@mdi/js` path string (`mdiHeart`, `mdiBug`, ...).
 * Keeps the codebase's existing icon imports working without Vuetify's <v-icon>.
 */
const props = defineProps<{
	icon: string;
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<svg
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
		:class="cn('inline-block size-5 shrink-0', props.class)"
	>
		<path :d="props.icon" />
	</svg>
</template>
