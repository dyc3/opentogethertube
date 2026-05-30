<template>
	<!--
		"Midnight Drive-In" hero backdrop. A glowing aurora sky (amber core,
		cyan signal tips) with warm projector god-rays raking down from the top,
		masked so it fades out before reaching the marquee text. All colors are
		pulled live from the active theme's CSS vars and re-read when the
		`data-theme` attribute changes, so it tracks every theme.
	-->
	<Shader v-if="mounted" class="hero-shader" tone-mapping="aces">
		<!-- opaque base so the canvas is grounded even before the glow ramps in -->
		<SolidColor :color="colors.ink" />

		<!-- mask: vibrant across the top, fading away toward the content below -->
		<Circle
			id="heroGlowMask"
			:visible="false"
			color="#ffffff"
			:radius="2"
			:softness="1"
			:center="{ x: 0.5, y: 0 }"
		/>

		<Group mask-source="heroGlowMask">
			<Aurora
				:color-a="colors.primaryDeep"
				:color-b="colors.primaryBright"
				:color-c="colors.signal"
				color-space="oklch"
				:intensity="72"
				:curtain-count="4"
				:speed="2.4"
				:waviness="78"
				:ray-density="30"
				:height="140"
				:center="{ x: 0.5, y: 0 }"
			/>
			<Godrays
				:center="{ x: 0.5, y: 0 }"
				:density="0.28"
				:intensity="0.6"
				:spotty="0.15"
				:speed="0.32"
				:ray-color="colors.primary"
			/>
		</Group>

		<!-- frame the eye toward the marquee, darken the edges back to ink -->
		<Vignette
			:color="colors.ink"
			:center="{ x: 0.5, y: 0.4 }"
			:radius="0.55"
			:falloff="0.85"
			:intensity="0.92"
		/>

		<!-- analog cinema grain over the whole composition -->
		<FilmGrain :strength="0.05" :bias="2.6" :animated="true" />
	</Shader>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Aurora, Circle, FilmGrain, Godrays, Group, Shader, SolidColor, Vignette } from "shaders/vue";

/** Read a CSS custom property off <html>, falling back to a dark-theme default. */
function getCSSVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

const colors = ref({
	ink: "#0c0a08",
	primary: "#ffbe3d",
	primaryBright: "#ffd271",
	primaryDeep: "#e89a1c",
	signal: "#4fe6df",
});

function readThemeColors() {
	colors.value = {
		ink: getCSSVar("--ink", "#0c0a08"),
		primary: getCSSVar("--primary", "#ffbe3d"),
		primaryBright: getCSSVar("--primary-bright", "#ffd271"),
		primaryDeep: getCSSVar("--primary-deep", "#e89a1c"),
		signal: getCSSVar("--signal", "#4fe6df"),
	};
}

// WebGPU only exists client-side; gate the canvas behind a mount flag.
const mounted = ref(false);
let observer: MutationObserver | null = null;

onMounted(() => {
	readThemeColors();
	mounted.value = true;
	// re-read whenever the theme switches (data-theme flips on <html>)
	observer = new MutationObserver(readThemeColors);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
});

onBeforeUnmount(() => {
	observer?.disconnect();
	observer = null;
});
</script>

<style scoped>
.hero-shader {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	/* sits above the .hero CSS fallback bg, below the z-10 content */
	z-index: 0;
}
</style>
