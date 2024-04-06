<template>
	<div class="dailymotion">
		<div id="dailymotion-player"></div>
	</div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref, toRefs, watch } from "vue";
import { getSdk } from "@/util/playerHelper.js";

interface DailymotionPlayerProps {
	videoId: string;
}

const DailymotionPlayer = defineComponent({
	name: "DailymotionPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	emits: ["apiready", "playing", "paused", "ready", "buffering", "error", "end"],
	setup(props: DailymotionPlayerProps, { emit, expose }) {
		const { videoId } = toRefs(props);
		const DM = ref();
		const player = ref();

		async function init() {
			const _DM = await getSdk(
				`https://geo.dailymotion.com/libs/player/${videoId.value}.js`,
				"dailymotion",
				"onScriptLoaded"
			);
			DM.value = _DM;
			console.debug("Dailymotion SDK loaded");

			player.value = DM.value.createPlayer("dailymotion-player", {
				video: videoId.value,
				width: "100%",
				height: "100%",
				params: {
					// "api": 1,
					autoplay: false,
					// "controls": false,
					// "ui-logo": false,
					// "ui-start-screen-info": false,
					enablePlaybackControls: false,
				},
				// events: {
				// 	apiready: () => {
				// 		console.debug("Dailymotion API ready");
				// 		emit("apiready");
				// 	},
				// 	// eslint-disable-next-line camelcase
				// 	video_end: () => emit("end"),
				// 	playing: () => emit("playing"),
				// 	pause: () => emit("paused"),
				// 	waiting: () => emit("buffering"),
				// 	// eslint-disable-next-line camelcase
				// 	playback_ready: () => emit("ready"),
				// 	error: () => emit("error"),
				// },
			});

			player.value.on(DM.value.events.VIDEO_PLAYING, () => emit("playing"));
			player.value.on(DM.value.events.VIDEO_PAUSE, () => emit("paused"));
			player.value.on(DM.value.events.VIDEO_BUFFERING, () => emit("buffering"));
			player.value.on(DM.value.events.PLAYER_VIDEOCHANGE, () => emit("ready"));
			player.value.on(DM.value.events.VIDEO_END, () => emit("end"));
			emit("apiready");
			emit("ready");
		}

		onMounted(async () => {
			await init();
		});

		onBeforeUnmount(() => {
			if (player.value) {
				player.value?.destroy();
			}
		});

		watch(videoId, () => {
			player.value.loadContent({ video: videoId.value });
		});

		function play() {
			return player.value.play();
		}
		function pause() {
			return player.value.pause();
		}
		function getPosition() {
			return player.value.currentTime;
		}
		function setPosition(position: number) {
			return player.value.seek(position);
		}
		function setVolume(value: number) {
			return player.value.setVolume(value / 100);
		}
		function isCaptionsSupported(): boolean {
			return false;
		}
		function getAvailablePlaybackRates(): number[] {
			return [1];
		}

		expose({
			play,
			pause,
			getPosition,
			setPosition,
			setVolume,
			isCaptionsSupported,
			getAvailablePlaybackRates,
		});

		return {
			player,
			play,
			pause,
			getPosition,
			setPosition,
			setVolume,
			isCaptionsSupported,
			getAvailablePlaybackRates,
		};
	},
});

export default DailymotionPlayer;
</script>
