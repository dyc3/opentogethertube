<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<div
		data-slot="card-footer"
		:class="
			cn(
				'bg-muted/50 rounded-b-xl border-t p-4 group-data-[size=sm]/card:p-3 flex items-center justify-end gap-2 mt-4',
				props.class,
			)
		"
	>
		<slot></slot>
	</div>
</template>
