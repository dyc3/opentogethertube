<script setup lang="ts">
import type { StringOrNumber } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { injectTabsRootContext } from "reka-ui";
import { cn } from "@/lib/utils";
import { TabsContentAnimatedOrderKey } from "./tabs-content-animated-context";

const props = defineProps<{
	class?: HTMLAttributes["class"];
	order?: readonly StringOrNumber[];
}>();

const rootContext = injectTabsRootContext();
const groupElement = ref<HTMLElement | null>(null);
const height = ref<number | null>(null);
const transitionHeight = ref(false);
let resizeObserver: ResizeObserver | null = null;
const animatedOrder = computed(() => props.order ?? Array.from(rootContext.contentIds.value));

provide(TabsContentAnimatedOrderKey, animatedOrder);

function getActivePanel() {
	return groupElement.value?.querySelector<HTMLElement>(
		'[data-slot="tabs-content"][data-state="active"]',
	);
}

async function updateHeight() {
	await nextTick();

	const activePanel = getActivePanel();
	if (!activePanel) {
		return;
	}

	resizeObserver?.disconnect();
	height.value = activePanel.scrollHeight;
	resizeObserver = new ResizeObserver(() => {
		height.value = activePanel.scrollHeight;
	});
	resizeObserver.observe(activePanel);

	requestAnimationFrame(() => {
		transitionHeight.value = true;
	});
}

watch(rootContext.modelValue, updateHeight, { immediate: true });
onMounted(updateHeight);

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
});
</script>

<template>
	<div
		ref="groupElement"
		:style="height === null ? undefined : { height: `${height}px` }"
		:class="
			cn(
				'relative overflow-hidden',
				transitionHeight &&
					'transition-[height] duration-250 ease-out motion-reduce:transition-none',
				props.class,
			)
		"
	>
		<slot></slot>
	</div>
</template>
