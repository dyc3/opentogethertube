<template>
	<span class="label-mono text-signal">{{ props.eyebrow }}</span>
	<h1
		class="relative mt-1 pl-4 font-display text-4xl tracking-wide before:absolute before:bottom-[0.1em] before:left-0 before:top-[0.1em] before:w-1 before:bg-primary before:shadow-[0_0_12px_var(--primary)] before:content-['']"
	>
		{{ props.title }}
	</h1>
</template>

<script setup lang="ts">
const props = defineProps<{
	eyebrow: string;
	title: string;
}>();
</script>
