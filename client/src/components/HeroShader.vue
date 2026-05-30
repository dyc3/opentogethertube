<template>
	<!--
		"Plasma" hero backdrop — a warped, glowing energy field: an amber plasma
		core with electric cyan filaments arcing through it, concentrated to the
		right and edges and masked away behind the headline so text stays readable.
		Grounded on an ink base and finished with a vignette + animated film grain.

		Colors are read live from the active theme's CSS vars and re-read whenever
		the <html data-theme> attribute changes, so it tracks every theme.
	-->
	<Shader v-if="mounted" class="hero-shader" tone-mapping="aces">
		<!-- opaque base so the canvas is grounded even before the field ramps in -->
		<SolidColor :color="colors.ink" />

		<!-- carve a calm zone behind the headline: energy fades out across the
		     left/center, strongest toward the right and edges -->
		<Circle
			id="readZone"
			:visible="false"
			color="#ffffff"
			:radius="1.45"
			:softness="0.8"
			:center="{ x: 0.4, y: 0.5 }"
		/>

		<!-- amber plasma core -->
		<Plasma
			:color-a="colors.primary"
			:color-b="colors.ink"
			color-space="oklch"
			:density="1.6"
			:speed="1.1"
			:warp="0.6"
			:intensity="1.45"
			:contrast="1.25"
			:balance="58"
			:opacity="0.95"
			mask-source="readZone"
			mask-type="alphaInverted"
		/>

		<!-- electric cyan filaments arcing through, added on top -->
		<Plasma
			:color-a="colors.signal"
			color-b="#000000"
			color-space="oklch"
			:density="2.6"
			:speed="0.85"
			:warp="0.85"
			:intensity="1.3"
			:contrast="1.55"
			:balance="44"
			:opacity="0.5"
			blend-mode="screen"
			mask-source="readZone"
			mask-type="alphaInverted"
		/>

		<!-- frame the eye toward the marquee, darken edges back to ink -->
		<Vignette
			:color="colors.ink"
			:center="{ x: 0.46, y: 0.44 }"
			:radius="0.54"
			:falloff="0.9"
			:intensity="0.9"
		/>

		<!-- analog grain over the whole composition, ties into the site texture -->
		<FilmGrain :strength="0.05" :bias="2.6" :animated="true" />
	</Shader>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Circle, FilmGrain, Plasma, Shader, SolidColor, Vignette } from "shaders/vue";

/** Read a CSS custom property off <html>, falling back to a dark-theme default. */
function getCSSVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

const colors = ref({
	ink: "#0c0a08",
	primary: "#ffbe3d",
	signal: "#4fe6df",
});

function readThemeColors() {
	colors.value = {
		ink: getCSSVar("--ink", "#0c0a08"),
		primary: getCSSVar("--primary", "#ffbe3d"),
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
