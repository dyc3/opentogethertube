<template>
	<v-col
		:class="{
			'video-controls': true,
			'in-video': mode == 'in-video',
			'outside-video': mode == 'outside-video',
			'hide': !controlsVisible,
		}"
	>
		<VideoProgressSlider :current-position="sliderPosition" />
		<v-row no-gutters class="controls-row2">
			<BasicControls :current-position="truePosition" />
			<!-- eslint-disable-next-line vue/no-v-model-argument -->
			<VolumeControl />
			<TimestampDisplay :current-position="truePosition" data-cy="timestamp-display" />
			<div class="grow"><!-- Spacer --></div>
			<ClosedCaptionsSwitcher
				:supported="captions.isCaptionsSupported.value"
				:tracks="captions.captionsTracks.value"
				@enable-cc="
					value => {
						captions.isCaptionsEnabled.value = value;
					}
				"
				@cc-track="value => (captions.currentTrack.value = value)"
			/>
			<PlaybackRateSwitcher />
			<LayoutSwitcher />
		</v-row>
	</v-col>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";

import BasicControls from "./BasicControls.vue";
import ClosedCaptionsSwitcher from "./ClosedCaptionsSwitcher.vue";
import LayoutSwitcher from "./LayoutSwitcher.vue";
import TimestampDisplay from "./TimestampDisplay.vue";
import VideoProgressSlider from "./VideoProgressSlider.vue";
import VolumeControl from "./VolumeControl.vue";
import PlaybackRateSwitcher from "./PlaybackRateSwitcher.vue";

import { useStore } from "@/store";
import { useCaptions, useMediaPlayer } from "../composables";

export default defineComponent({
	name: "VideoControls",
	components: {
		BasicControls,
		ClosedCaptionsSwitcher,
		LayoutSwitcher,
		TimestampDisplay,
		VideoProgressSlider,
		VolumeControl,
		PlaybackRateSwitcher,
	},
	props: {
		sliderPosition: {
			type: Number,
			required: true,
		},
		truePosition: {
			type: Number,
			required: true,
		},
		controlsVisible: {
			type: Boolean,
			default: false,
		},
		mode: {
			type: String as PropType<"in-video" | "outside-video">,
			default: "in-video",
		},
	},
	emits: [],
	setup() {
		const store = useStore();
		const player = useMediaPlayer();
		const captions = useCaptions();

		return {
			store,
			player,
			captions,
		};
	},
});
</script>

<style lang="scss">
$video-controls-height: 80px;
$media-control-background: var(--v-theme-media-control-background, (0, 0, 0));

.grow {
	flex-grow: 1;
}

.video-controls {
	flex-basis: auto;
	min-height: $video-controls-height;
	transition: all 0.2s;
	z-index: 100;

	&.in-video {
		position: relative;
		bottom: $video-controls-height;

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
		position: relative;
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
		align-items: center;
	}
}
</style>
