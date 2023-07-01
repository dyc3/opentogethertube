<template>
	<div class="dailymotion">
		<div id="dailymotion-player"></div>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, toRefs, watch } from "vue";
import { getSdk } from "@/util/playerHelper.js";

const DAILYMOTION_SDK_URL = "https://api.dmcdn.net/all.js";

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

		function updateIframe() {
			player.value = new DM.value.player(document.getElementById("dailymotion-player"), {
				video: videoId.value,
				width: "100%",
				height: "100%",
				params: {
					"api": 1,
					"autoplay": false,
					"controls": false,
					"ui-logo": false,
					"ui-start-screen-info": false,
				},
				events: {
					apiready: () => emit("apiready"),
					video_end: () => emit("end"),
					playing: () => emit("playing"),
					pause: () => emit("paused"),
					waiting: () => emit("buffering"),
					playback_ready: () => emit("ready"),
					error: () => emit("error"),
				},
			});
		}

		onMounted(async () => {
			const _DM = await getSdk(DAILYMOTION_SDK_URL, "DM", "dmAsyncInit");
			DM.value = _DM;
			DM.value.init({
				status: false,
				cookie: false,
			});
			updateIframe();
		});

		watch(videoId, () => {
			updateIframe();
			player.value.load({ video: videoId.value });
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

<style lang="scss" scoped>
.dailymotion {
	color: #696969;
}
</style>
