<template>
	<div
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-label="label"
		:title="label"
		:aria-valuenow="size"
		:aria-valuemin="min"
		:aria-valuemax="maxSize()"
		class="group flex w-3 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none select-none"
		data-cy="resize-handle"
		@pointerdown="onPointerDown"
		@dblclick="size = clamp(defaultSize)"
		@keydown="onKeyDown"
	>
		<div
			class="h-12 w-1 rounded-full transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
			:class="dragging ? 'bg-primary' : 'bg-muted-foreground/40'"
		/>
		<!--
			Embedded players are iframes, which swallow pointer events once the cursor passes over
			them. Covering the page while dragging keeps the drag alive.
		-->
		<Teleport to="body">
			<div
				v-if="dragging"
				class="fixed inset-0 z-[9999] cursor-col-resize"
				data-cy="resize-shield"
			/>
		</Teleport>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useEventListener } from "@vueuse/core";

const KEYBOARD_STEP = 24;

const props = withDefaults(
	defineProps<{
		/** Accessible name, also shown as a tooltip. */
		label: string;
		/** `1` if dragging right grows the panel, `-1` if dragging left grows it. */
		direction?: 1 | -1;
		min: number;
		/** Upper bound as a fraction of the viewport width. */
		maxFraction?: number;
		defaultSize: number;
	}>(),
	{ direction: 1, maxFraction: 0.6 },
);
const size = defineModel<number>({ required: true });

const dragging = ref(false);
let dragStartX = 0;
let dragStartSize = 0;

function maxSize() {
	return Math.max(props.min, Math.round(window.innerWidth * props.maxFraction));
}

function clamp(value: number) {
	return Math.round(Math.min(maxSize(), Math.max(props.min, value)));
}

function onPointerDown(e: PointerEvent) {
	if (e.button !== 0) {
		return;
	}
	e.preventDefault();
	dragging.value = true;
	dragStartX = e.clientX;
	dragStartSize = size.value;
	window.addEventListener("pointermove", onPointerMove);
	window.addEventListener("pointerup", stopDragging);
	window.addEventListener("pointercancel", stopDragging);
}

function onPointerMove(e: PointerEvent) {
	size.value = clamp(dragStartSize + (e.clientX - dragStartX) * props.direction);
}

function stopDragging() {
	dragging.value = false;
	window.removeEventListener("pointermove", onPointerMove);
	window.removeEventListener("pointerup", stopDragging);
	window.removeEventListener("pointercancel", stopDragging);
}

function onKeyDown(e: KeyboardEvent) {
	if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
		return;
	}
	e.preventDefault();
	// The room binds the arrow keys to seeking.
	e.stopPropagation();
	const sign = e.key === "ArrowRight" ? 1 : -1;
	size.value = clamp(size.value + sign * props.direction * KEYBOARD_STEP);
}

/** Keep a stored size valid for the current viewport, without writing when nothing changed. */
function reclamp() {
	const clamped = clamp(size.value);
	if (clamped !== size.value) {
		size.value = clamped;
	}
}
onMounted(reclamp);
useEventListener(window, "resize", reclamp);
onUnmounted(stopDragging);
</script>
