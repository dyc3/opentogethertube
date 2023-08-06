<template>
	<vue-slider
		id="videoSlider"
		:interval="0.1"
		:lazy="true"
		:model-value="currentPosition"
		:max="normalisedVideoLength"
		:tooltip-formatter="sliderTooltipFormatter"
		:disabled="
			store.state.room.currentSource?.length === undefined || !granted('playback.seek')
		"
		:process="getSliderProcesses"
		@change="sliderChange"
		:drag-on-click="true"
		tooltip="none"
		:duration="0"
	/>
	<div
		id="seek-preview"
		:class="{ hide: !seekPreviewVisible }"
		:style="{
			left: seekPreviewX + 'px',
		}"
	>
		<span>{{ seekPreviewTimestamp }}</span>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, onMounted, onUpdated, computed } from "vue";
import VueSlider from "vue-slider-component";
import { useStore } from "@/store";
import { granted } from "@/util/grants";
import { secondsToTimestamp } from "@/util/timestamp";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import "vue-slider-component/theme/default.css";
import "./slider-tweaks.scss";

export const VideoProgressSlider = defineComponent({
	name: "VideoProgressSlider",
	components: {
		VueSlider,
	},
	props: {
		currentPosition: {
			type: Number,
			required: true,
		},
	},
	setup() {
		const store = useStore();
		const roomapi = useRoomApi(useConnection());

		/**
		 * vue-slider-component requires (props.max - props.min) to be divisible by props.interval.
		 * Some videos have an irregular length (e.g. 100.117), which will break the slider unless rounded (e.g. after rounding, 100.1).
		 * This function rounds the video length provided by the server to 1 decimal place.
		 * The video length is then used by the slider to define the maximum value (props.max).
		 */
		const normalisedVideoLength = computed((): number => {
			if (store.state.room.currentSource && store.state.room.currentSource.length) {
				const videoLength = store.state.room.currentSource.length;
				return Math.round(videoLength * 10) / 10;
			} else {
				return 0;
			}
		});

		const sliderTooltipFormatter = ref(secondsToTimestamp);

		function sliderChange(value: number) {
			roomapi.seek(value);
		}

		/**
		 * Computes the `process` property of the playback position slider.
		 * Used to show colored intervals in the slider.
		 * Intervals will be layared in the order of they are listed. The last interval will appear on the top.
		 * Values are from 0 to 100, regardless of min and max values of the slider.
		 */
		function getSliderProcesses(dotsPos: number[]) {
			const processes: [number, number, { backgroundColor: string }][] = [];

			const bufferedColor = "rgb(var(--v-theme-primary-lighten-1))";
			// show buffered spans
			const bufferSpans = store.state.playerBufferSpans;
			if (
				bufferSpans &&
				store.state.room.currentSource &&
				store.state.room.currentSource.length
			) {
				for (let i = 0; i < bufferSpans.length; i++) {
					const start =
						(bufferSpans.start(i) / store.state.room.currentSource.length) * 100;
					const end = (bufferSpans.end(i) / store.state.room.currentSource.length) * 100;
					processes.push([start, end, { backgroundColor: bufferedColor }]);
				}
			} else if (store.state.playerBufferPercent) {
				processes.push([
					0,
					store.state.playerBufferPercent * 100,
					{ backgroundColor: bufferedColor },
				]);
			}

			// show seek preview, if present
			processes.push([
				0,
				(seekPreviewPercent.value ?? 0) * 100,
				{ backgroundColor: "rgba(var(--v-theme-secondary), 50%)" },
			]);

			// show video progress
			processes.push([0, dotsPos[0], { backgroundColor: "rgb(var(--v-theme-primary))" }]);

			// show sponsorblock segments
			const colorMap = new Map([
				["sponsor", "#00d400"],
				["selfpromo", "#ffff00"],
				["interaction", "#cc00ff"],
				["intro", "#00ffff"],
				["outro", "#0202ed"],
			]);
			if (store.state.room.videoSegments) {
				for (const segment of store.state.room.videoSegments) {
					const start = (segment.startTime / segment.videoDuration) * 100;
					const end = (segment.endTime / segment.videoDuration) * 100;
					processes.push([
						start,
						end,
						{ backgroundColor: colorMap.get(segment.category) ?? "#ff0000" },
					]);
				}
			}

			return processes;
		}

		// computed as a percentage of the slider width
		const seekPreviewPercent: Ref<number | null> = ref(null);
		const seekPreviewTimestamp = ref("");
		const seekPreviewX = ref(0); // x position of the timestamp
		const railHovered = ref(false);
		const seekPreviewVisible = computed(() => {
			return railHovered.value;
		});

		function updateSeekPreview(e) {
			const slider = document.getElementById("videoSlider");
			if (!slider) {
				return;
			}
			railHovered.value = true;
			const sliderRect = slider.getBoundingClientRect();
			const sliderPos = e.clientX - sliderRect.left;
			seekPreviewPercent.value = sliderPos / sliderRect.width;
			seekPreviewTimestamp.value = secondsToTimestamp(
				seekPreviewPercent.value * (store.state.room.currentSource?.length ?? 0)
			);
			const seekPreview = document.getElementById("seek-preview");
			if (!seekPreview) {
				return;
			}
			const baseX = sliderPos;
			const seekPreviewRect = seekPreview.getBoundingClientRect();
			seekPreviewX.value = baseX + 12 - seekPreviewRect.width / 2;
		}

		function resetSeekPreview() {
			seekPreviewPercent.value = null;
			railHovered.value = false;
		}

		onMounted(() => {
			const slider = document.getElementById("videoSlider");
			if (!slider) {
				return;
			}
			slider.addEventListener("mousemove", updateSeekPreview);
			slider.addEventListener("mouseleave", resetSeekPreview);
		});

		onUpdated(() => {
			const slider = document.getElementById("videoSlider");
			if (!slider) {
				return;
			}
			slider.removeEventListener("mousemove", updateSeekPreview);
			slider.removeEventListener("mouseleave", resetSeekPreview);
			slider.addEventListener("mousemove", updateSeekPreview);
			slider.addEventListener("mouseleave", resetSeekPreview);
		});

		return {
			store,
			granted,

			normalisedVideoLength,

			sliderTooltipFormatter,

			sliderChange,
			getSliderProcesses,
			seekPreviewX,
			seekPreviewTimestamp,
			seekPreviewVisible,
		};
	},
});

export default VideoProgressSlider;
</script>

<style lang="scss" scoped>
#seek-preview {
	position: absolute;
	top: -14px;
	background-color: rgba(0, 0, 0, 0.6);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2px 6px;
	text-align: center;
	pointer-events: none;
}

.hide {
	opacity: 0;
}
</style>
