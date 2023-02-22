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
		<v-row no-gutters align="center">
			<BasicControls :current-position="truePosition" />
			<!-- eslint-disable-next-line vue/no-v-model-argument -->
			<VolumeControl />
			<TimestampDisplay :current-position="truePosition" />
			<div class="flex-grow-1"><!-- Spacer --></div>
			<ClosedCaptionsSwitcher
				:supported="isCaptionsSupported"
				:tracks="store.state.captions.availableTracks"
				@enable-cc="value => player.setCaptionsEnabled(value)"
				@cc-track="value => player.setCaptionsTrack(value)"
			/>
			<PlaybackRateSwitcher :current-rate="1" :available-rates="[1]" />
			<LayoutSwitcher />
		</v-row>
	</v-col>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, toRefs } from "vue";

import BasicControls from "./BasicControls.vue";
import ClosedCaptionsSwitcher from "./ClosedCaptionsSwitcher.vue";
import LayoutSwitcher from "./LayoutSwitcher.vue";
import TimestampDisplay from "./TimestampDisplay.vue";
import VideoProgressSlider from "./VideoProgressSlider.vue";
import VolumeControl from "./VolumeControl.vue";
import PlaybackRateSwitcher from "./PlaybackRateSwitcher.vue";

import type OmniPlayer from "../players/OmniPlayer.vue";
import type { MediaPlayer, MediaPlayerWithCaptions } from "../players/OmniPlayer.vue";
import { useStore } from "@/store";

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
		player: {
			type: Object as PropType<typeof OmniPlayer | null>,
			required: true,
		},
		controlsVisible: {
			type: Boolean,
			default: false,
		},
		isCaptionsSupported: {
			type: Boolean,
			default: false,
		},
		mode: {
			type: String as PropType<"in-video" | "outside-video">,
			default: "in-video",
		},
	},
	emits: [],
	setup(props) {
		let store = useStore();
		let { player } = toRefs(props);

		function isPlayerPresent(p: Ref<typeof OmniPlayer>): p is Ref<typeof OmniPlayer> {
			return !!p.value;
		}

		function isCaptionsSupported(
			p: Ref<MediaPlayer | MediaPlayerWithCaptions>
		): p is Ref<MediaPlayerWithCaptions> {
			return (player.value as MediaPlayerWithCaptions)?.isCaptionsSupported() ?? false;
		}
		function getCaptionsTracks(): string[] {
			if (!isPlayerPresent(player)) {
				return [];
			}
			if (!isCaptionsSupported(player)) {
				return [];
			}
			return player.value.getCaptionsTracks() ?? [];
		}

		return {
			store,

			getCaptionsTracks,
		};
	},
});
</script>

<style lang="scss">
$video-controls-height: 80px;

.video-controls {
	height: $video-controls-height;
	transition: all 0.2s;
	z-index: 100;

	&.in-video {
		position: relative;
		bottom: $video-controls-height;

		background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
		transition: all 0.2s;

		&.hide {
			opacity: 0;
			transition: all 0.5s;
			bottom: 0;
		}
	}

	&.outside-video {
		position: relative;
		background: #000;
		border-radius: 0 0 10px 10px;

		&.hide {
			opacity: 0;
			transform: scaleY(0) translateY(-50%);
			transition: all 0.5s;
			height: 0;
		}
	}
}
</style>
