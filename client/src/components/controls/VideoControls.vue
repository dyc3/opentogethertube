<template>
	<div class="video-controls-wrapper" :class="{ 'mobile-portrait-controls': isMobilePortraitControls }">
		<div
			:class="{
				'video-controls': true,
				'in-video': mode == 'in-video',
				'outside-video': mode == 'outside-video',
				'hide': !controlsVisible,
			}"
		>
			<VideoProgressSlider v-if="showAdvancedControls" :current-position="sliderPosition" />
			<div class="controls-row2">
				<!-- Playback controls - Projectionist only -->
				<BasicControls v-if="showAdvancedControls" :current-position="truePosition" />
				<!-- Volume - Always visible -->
				<!-- eslint-disable-next-line vue/no-v-model-argument -->
				<VolumeControl />
				<!-- Timestamp - Always visible for playtime info -->
				<TimestampDisplay :current-position="truePosition" data-cy="timestamp-display" />
				<div class="grow"><!-- Spacer --></div>
				<!-- Captions - Hidden on mobile portrait controls-only -->
				<ClosedCaptionsSwitcher v-if="!isMobilePortraitControls" />
				<!-- Playback speed - Projectionist only -->
				<PlaybackRateSwitcher v-if="showAdvancedControls" />
				<!-- Video settings - Projectionist only -->
				<VideoSettings v-if="showAdvancedControls" />
				<!-- Fullscreen - Hidden on mobile portrait controls-only, also hidden for advanced users (LayoutSwitcher provides it) -->
				<FullscreenButton v-if="!isMobilePortraitControls && !showAdvancedControls" />
				<!-- PiP - Hidden on mobile portrait controls-only -->
				<PictureInPictureButton v-if="!isMobilePortraitControls" />
				<!-- Layout switcher - Projectionist only (includes fullscreen button) -->
				<LayoutSwitcher v-if="showAdvancedControls" />
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, watch, ref, onMounted } from "vue";
import BasicControls from "./BasicControls.vue";
import ClosedCaptionsSwitcher from "./ClosedCaptionsSwitcher.vue";
import LayoutSwitcher from "./LayoutSwitcher.vue";
import TimestampDisplay from "./TimestampDisplay.vue";
import VideoProgressSlider from "./VideoProgressSlider.vue";
import VolumeControl from "./VolumeControl.vue";
import PlaybackRateSwitcher from "./PlaybackRateSwitcher.vue";
import VideoSettings from "./VideoSettings.vue";
import PictureInPictureButton from "./PictureInPictureButton.vue";
import FullscreenButton from "./FullscreenButton.vue";

const props = withDefaults(
	defineProps<{
		sliderPosition: number;
		truePosition: number;
		controlsVisible: boolean;
		mode: "in-video" | "outside-video";
		isProjectionMode?: boolean;
		isProjectionist?: boolean;
	}>(),
	{
		controlsVisible: false,
		mode: "in-video",
		isProjectionMode: false,
		isProjectionist: false,
	}
);

// Reactive state for mobile portrait detection and fullscreen
const isMobilePortrait = ref(false);
const isFullscreen = ref(false);

function updateMobilePortraitState() {
	const isMobileScreen = window.matchMedia('(max-width: 760px)').matches;
	const isPortrait = window.matchMedia('(orientation: portrait)').matches;

	// Check for touch capability to distinguish real mobile from desktop with small window
	const isTouchDevice = (
		'ontouchstart' in window ||
		navigator.maxTouchPoints > 0 ||
		(navigator as any).msMaxTouchPoints > 0
	);

	// True mobile = mobile screen AND touch capability
	const isMobile = isMobileScreen && isTouchDevice;

	isMobilePortrait.value = isMobile && isPortrait;
}

function updateFullscreenState() {
	isFullscreen.value = document.fullscreenElement !== null;
}

// Detect if this is mobile portrait controls-only mode (for compact layout and hiding buttons)
// Don't hide buttons when in fullscreen - user needs access to all controls
const isMobilePortraitControls = computed(() => {
	const result = props.mode === 'outside-video' &&
		   isMobilePortrait.value &&
		   props.isProjectionMode &&
		   !props.isProjectionist &&
		   !isFullscreen.value;  // Show all buttons when fullscreen

	console.log('[VideoControls] isMobilePortraitControls:', {
		mode: props.mode,
		isMobilePortrait: isMobilePortrait.value,
		isProjectionMode: props.isProjectionMode,
		isProjectionist: props.isProjectionist,
		isFullscreen: isFullscreen.value,
		result
	});

	return result;
});

// Determine if audience-restricted controls should be shown
const showAdvancedControls = computed(() => {
	const result = !props.isProjectionMode ? true : props.isProjectionist === true;
	console.log('[VideoControls] Computing showAdvancedControls:',
		'isProjectionMode=', props.isProjectionMode,
		'isProjectionist=', props.isProjectionist,
		'result=', result
	);

	// If not in projection mode, show everything
	if (!props.isProjectionMode) {
		return true;
	}
	// In projection mode, only projectionist sees advanced controls
	return props.isProjectionist === true;
});

// Watch for prop changes to verify reactivity
watch(() => props.isProjectionist, (newVal, oldVal) => {
	console.log('[VideoControls] isProjectionist changed:', { oldVal, newVal });
});

watch(() => props.isProjectionMode, (newVal, oldVal) => {
	console.log('[VideoControls] isProjectionMode changed:', { oldVal, newVal });
});

onMounted(() => {
	// Initialize mobile portrait and fullscreen state
	updateMobilePortraitState();
	updateFullscreenState();

	// Watch for orientation and resize changes
	window.addEventListener('resize', updateMobilePortraitState);
	const orientationMQ = window.matchMedia('(orientation: portrait)');
	orientationMQ.addEventListener('change', updateMobilePortraitState);

	// Watch for fullscreen changes
	document.addEventListener('fullscreenchange', updateFullscreenState);
});
</script>

<style lang="scss">
@use "./media-controls.scss";
@use "../../variables.scss";

$media-control-background: var(--v-theme-media-control-background, (0, 0, 0));

.grow {
	flex-grow: 1;
}

.video-controls {
	min-height: media-controls.$video-controls-height;
	transition: all 0.2s;
	z-index: 100;
	padding: 12px;
	width: 100%;

	// Mobile-responsive height and padding
	@media (max-width: variables.$xs-max) {
		min-height: media-controls.$video-controls-height-mobile;
		padding: 8px 12px; // Reduced vertical padding to minimize excess space
	}

	&.in-video {
		position: absolute;
		bottom: 0;

		background: linear-gradient(
			to top,
			rgba($media-control-background, 0.65),
			rgba($media-control-background, 0)
		);
		transition: all 0.2s;

		&.hide {
			opacity: 0;
			transition: all 0.5s;
			bottom: 0;
		}
	}

	&.outside-video {
		background: transparent;
		border-radius: 0 0 10px 10px;

		&.hide {
			opacity: 0;
			transform: scaleY(0) translateY(-50%);
			transition: all 0.5s;
			height: 0;
		}
	}

	.controls-row2 {
		display: flex;
		align-items: center;
		gap: 8px;

		// Mobile-responsive layout with horizontal scrolling
		@media (max-width: variables.$xs-max) {
			gap: 12px;
			overflow-x: auto;
			flex-wrap: nowrap; // Prevent wrapping to enable horizontal scroll
			padding-right: 8px; // Add padding for scroll area
			
			// Smooth scrolling behavior
			scroll-behavior: smooth;
			-webkit-overflow-scrolling: touch;
			
			// Hide scrollbar while keeping scroll functionality
			scrollbar-width: none;
			&::-webkit-scrollbar {
				display: none;
				height: 0;
			}
		}
	}
}

// Video controls wrapper - ensure transparent background for controls-only mode
.video-controls-wrapper {
	background: transparent;
}

// Mobile portrait controls-only mode: compact layout
.mobile-portrait-controls {
	.video-controls {
		min-height: 60px !important;
		padding: 8px 12px !important;
	}

	.controls-row2 {
		gap: 12px;
	}
}
</style>
