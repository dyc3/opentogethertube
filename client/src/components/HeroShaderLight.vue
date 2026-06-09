<template>
	<!--
		Light-theme hero backdrop — "Silk". Dark themes get the moody amber Plasma
		(HeroShader.vue); a glowing energy field reads badly on a pale page, so
		light themes get this instead: a bold liquid-silk mesh gradient woven from
		the theme's own colors, masked away behind the left-aligned headline so the
		text stays legible. Colors are read live from the active theme's CSS vars
		and re-read whenever <html data-theme> changes, so it tracks every light
		theme (warm amber on "light", candy pink/green on "strawberry").
	-->
	<Shader v-if="mounted" class="hero-shader" :class="{ 'is-ready': ready }" tone-mapping="aces">
		<!-- grounded base so the canvas matches the page before the field ramps in -->
		<SolidColor :color="colors.base" />

		<!-- carve a calm zone behind the headline: silk strongest toward the right -->
		<Circle
			id="readZone"
			:visible="false"
			color="#ffffff"
			:radius="1.3"
			:softness="0.95"
			:center="{ x: 0.34, y: 0.5 }"
		/>

		<!-- flowing liquid-silk bands in the theme's palette -->
		<FlowingGradient
			:color-a="colors.base"
			:color-b="colors.primary"
			:color-c="colors.signal"
			:color-d="colors.primaryBright"
			color-space="oklch"
			:speed="1.2"
			:distortion="0.75"
			:opacity="0.92"
			mask-source="readZone"
			mask-type="alphaInverted"
		/>
	</Shader>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Circle, FlowingGradient, Shader, SolidColor } from "shaders/vue";

/** Read a CSS custom property off <html>, falling back to a light default. */
function getCSSVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

const colors = ref({
	base: "#f6efe1",
	primary: "#d97706",
	primaryBright: "#f59e0b",
	signal: "#0d8b8f",
});

function readThemeColors() {
	colors.value = {
		base: getCSSVar("--background", "#f6efe1"),
		primary: getCSSVar("--primary", "#d97706"),
		primaryBright: getCSSVar("--primary-bright", "#f59e0b"),
		signal: getCSSVar("--signal", "#0d8b8f"),
	};
}

// WebGPU only exists client-side; gate the canvas behind a mount flag.
const mounted = ref(false);
// flipped a beat after mount so the canvas crossfades in instead of popping.
const ready = ref(false);
let observer: MutationObserver | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
	readThemeColors();
	mounted.value = true;
	fadeTimer = setTimeout(() => {
		ready.value = true;
	}, 150);
	observer = new MutationObserver(readThemeColors);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
	clearTimeout(fadeTimer);
});
</script>

<style scoped>
.hero-shader {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 0;
	opacity: 0;
	transition: opacity 1s ease;
}
.hero-shader.is-ready {
	opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
	.hero-shader {
		transition: none;
	}
}
</style>
