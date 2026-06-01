<template>
	<!--
		"Plasma" hero backdrop — a warped, glowing energy field: an amber plasma
		core with electric cyan filaments arcing through it, concentrated to the
		right and edges and masked away behind the headline so text stays readable.
		Grounded on an ink base and finished with a vignette + animated film grain.

		Colors are read live from the active theme's CSS vars and re-read whenever
		the <html data-theme> attribute changes, so it tracks every theme.
	-->
	<Shader v-if="mounted" class="hero-shader" :class="{ 'is-ready': ready }" tone-mapping="aces">
		<!-- opaque base so the canvas is grounded even before the field ramps in -->
		<SolidColor :color="cfg.base" />

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

		<!-- warm plasma core -->
		<Plasma
			:color-a="cfg.coreA"
			:color-b="cfg.coreB"
			color-space="oklch"
			:density="1.6"
			:speed="1.1"
			:warp="0.6"
			:intensity="cfg.coreIntensity"
			:contrast="cfg.coreContrast"
			:balance="58"
			:opacity="cfg.coreOpacity"
			mask-source="readZone"
			mask-type="alphaInverted"
		/>

		<!-- accent filaments arcing through, added on top -->
		<Plasma
			:color-a="cfg.accentA"
			:color-b="cfg.accentB"
			color-space="oklch"
			:density="2.6"
			:speed="0.85"
			:warp="0.85"
			:intensity="cfg.accentIntensity"
			:contrast="1.55"
			:balance="44"
			:opacity="cfg.accentOpacity"
			:blend-mode="cfg.accentBlend"
			mask-source="readZone"
			mask-type="alphaInverted"
		/>

		<!-- frame the eye toward the marquee, darken edges back to the base -->
		<Vignette
			:color="cfg.base"
			:center="{ x: 0.46, y: 0.44 }"
			:radius="0.54"
			:falloff="0.9"
			:intensity="cfg.vignette"
		/>

		<!-- analog grain over the whole composition, ties into the site texture -->
		<FilmGrain :strength="0.05" :bias="2.6" :animated="true" />
	</Shader>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Circle, FilmGrain, Plasma, Shader, SolidColor, Vignette } from "shaders/vue";

/** Read a CSS custom property off <html>, falling back to a default. */
function getCSSVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}
function getCSSNum(name: string, fallback: number): number {
	const value = parseFloat(getCSSVar(name, ""));
	return Number.isFinite(value) ? value : fallback;
}

/*
 * The whole field is themeable. Dark themes fall back to the original
 * amber-core / cyan-screen look; light themes set `--hero-*` tokens to get a
 * richer, higher-contrast composition that actually reads on a pale page
 * (a "screen" accent is invisible on light, so light uses "multiply"). Tokens
 * default to the active theme's --primary/--signal/--ink so a theme that sets
 * nothing still tracks its palette.
 */
const cfg = ref({
	base: "#0c0a08",
	coreA: "#ffbe3d",
	coreB: "#0c0a08",
	coreIntensity: 1.45,
	coreContrast: 1.25,
	coreOpacity: 0.95,
	accentA: "#4fe6df",
	accentB: "#000000",
	accentIntensity: 1.3,
	accentOpacity: 0.5,
	accentBlend: "screen",
	vignette: 0.9,
});

function readThemeColors() {
	const ink = getCSSVar("--ink", "#0c0a08");
	const primary = getCSSVar("--primary", "#ffbe3d");
	const signal = getCSSVar("--signal", "#4fe6df");
	cfg.value = {
		base: getCSSVar("--hero-base", ink),
		coreA: getCSSVar("--hero-core-a", primary),
		coreB: getCSSVar("--hero-core-b", ink),
		coreIntensity: getCSSNum("--hero-core-intensity", 1.45),
		coreContrast: getCSSNum("--hero-core-contrast", 1.25),
		coreOpacity: getCSSNum("--hero-core-opacity", 0.95),
		accentA: getCSSVar("--hero-accent-a", signal),
		accentB: getCSSVar("--hero-accent-b", "#000000"),
		accentIntensity: getCSSNum("--hero-accent-intensity", 1.3),
		accentOpacity: getCSSNum("--hero-accent-opacity", 0.5),
		accentBlend: getCSSVar("--hero-accent-blend", "screen"),
		vignette: getCSSNum("--hero-vignette", 0.9),
	};
}

// WebGPU only exists client-side; gate the canvas behind a mount flag.
const mounted = ref(false);
// flipped a beat after mount so the canvas crossfades in from the ink
// background instead of popping once its first GPU frame paints.
const ready = ref(false);
let observer: MutationObserver | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
	readThemeColors();
	mounted.value = true;
	// give the shader a moment to render its first frame, then fade it in
	fadeTimer = setTimeout(() => {
		ready.value = true;
	}, 150);
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
	/* sits above the .hero CSS fallback bg, below the z-10 content */
	z-index: 0;
	/* crossfade in from the ink hero background once the first frame paints */
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
