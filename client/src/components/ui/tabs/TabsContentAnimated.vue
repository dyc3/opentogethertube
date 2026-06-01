<script setup lang="ts">
import type { TabsContentProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed, inject } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { injectTabsRootContext } from "reka-ui";
import { cn } from "@/lib/utils";
import TabsContent from "./TabsContent.vue";
import { TabsContentAnimatedOrderKey } from "./tabs-content-animated-context";

const props = defineProps<
	Omit<TabsContentProps, "forceMount"> & {
		class?: HTMLAttributes["class"];
	}
>();

const delegatedProps = reactiveOmit(props, "class");
const rootContext = injectTabsRootContext();
const fallbackOrder = computed(() => Array.from(rootContext.contentIds.value));
const order = inject(TabsContentAnimatedOrderKey, fallbackOrder);

const contentClass = computed(() => {
	const currentValue = rootContext.modelValue.value;
	const currentIndex = order.value.indexOf(currentValue ?? "");
	const tabIndex = order.value.indexOf(props.value);
	const isActive = props.value === currentValue;

	return cn(
		"absolute inset-x-0 top-0 w-full transition-all duration-250 ease-out motion-reduce:transition-none motion-reduce:transform-none",
		"pointer-events-none opacity-0",
		!isActive && tabIndex < currentIndex ? "-translate-x-12" : "translate-x-12",
		isActive && "pointer-events-auto translate-x-0 opacity-100",
		props.class,
	);
});
</script>

<template>
	<TabsContent
		force-mount
		:aria-hidden="rootContext.modelValue.value !== props.value"
		:inert="rootContext.modelValue.value !== props.value"
		:class="contentClass"
		v-bind="delegatedProps"
	>
		<slot></slot>
	</TabsContent>
</template>
