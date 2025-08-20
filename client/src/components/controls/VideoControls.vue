<template>
	<div class="video-controls-wrapper">
		<div
			:class="{
				'video-controls': true,
				'in-video': mode == 'in-video',
				'outside-video': mode == 'outside-video',
				'hide': !controlsVisible,
			}"
		>
			<VideoProgressSlider :current-position="sliderPosition" />
			<div class="controls-row2">
				<BasicControls :current-position="truePosition" />
				<!-- eslint-disable-next-line vue/no-v-model-argument -->
				<VolumeControl />
				<TimestampDisplay :current-position="truePosition" data-cy="timestamp-display" />
				<div class="grow"><!-- Spacer --></div>
				<ClosedCaptionsSwitcher />
				<PlaybackRateSwitcher />
				<LayoutSwitcher />
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import BasicControls from "./BasicControls.vue";
import ClosedCaptionsSwitcher from "./ClosedCaptionsSwitcher.vue";
import LayoutSwitcher from "./LayoutSwitcher.vue";
import PlaybackRateSwitcher from "./PlaybackRateSwitcher.vue";
import TimestampDisplay from "./TimestampDisplay.vue";
import VideoProgressSlider from "./VideoProgressSlider.vue";
import VolumeControl from "./VolumeControl.vue";

withDefaults(
	defineProps<{
		sliderPosition: number;
		truePosition: number;
		controlsVisible: boolean;
		mode: "in-video" | "outside-video";
	}>(),
	{
		controlsVisible: false,
		mode: "in-video",
	}
);
</script>

<style lang="scss">
$video-controls-height: 90px;
$media-control-background: var(--v-theme-media-control-background, (0, 0, 0));

.grow {
	flex-grow: 1;
}

.video-controls {
	min-height: $video-controls-height;
	transition: all 0.2s;
	z-index: 100;
	padding: 12px;
	width: 100%;

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
		background: rgb($media-control-background);
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
	}
}
</style>
