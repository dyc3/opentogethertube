<template>
	<div class="vimeo" id="vimeo-player"></div>
</template>

<script lang="ts">
import { defineComponent, onMounted, watch } from "vue";
import vimeo from "@vimeo/player";

const VimeoPlayer = defineComponent({
	name: "VimeoPlayer",
	props: {
		videoId: { type: String, required: true },
	},
	emits: ["playing", "paused", "ready", "buffering", "error", "apiready"],
	setup(props, { emit }) {
		let player: vimeo | undefined = undefined;
		let isBuffering = false;

		onMounted(async () => {
			let container = document.getElementById("vimeo-player");
			if (!container) {
				return;
			}
			let parsedId = parseInt(props.videoId);
			player = new vimeo(container, {
				id: parsedId,
				controls: false,
				playsinline: true,
				responsive: true,
				portrait: false,
			});
			setTimeout(() => {
				if (!player) {
					return;
				}
				player.on("play", () => emit("playing"));
				player.on("pause", () => emit("paused"));
				player.on("loaded", () => emit("ready"));
				player.on("bufferstart", () => {
					isBuffering = true;
					emit("buffering");
				});
				player.on("bufferend", () => {
					isBuffering = false;
					emit("ready");
				});
				player.on("error", () => emit("error"));
				emit("apiready");
			}, 0);
		});

		watch(props, () => {
			if (!player) {
				return;
			}
			let parsedId = parseInt(props.videoId);
			player.loadVideo(parsedId);
		});

		function play() {
			if (!player) {
				return;
			}
			return player.play();
		}
		function pause() {
			if (!player) {
				return;
			}
			return player.pause();
		}
		async function getPosition(): Promise<number> {
			if (!player) {
				return 0;
			}
			return player.getCurrentTime();
		}
		function setPosition(position: number) {
			if (!player) {
				return;
			}
			return player.setCurrentTime(position);
		}
		function setVolume(value: number) {
			if (!player) {
				return;
			}
			return player.setVolume(value / 100);
		}
		function isCaptionsSupported(): boolean {
			return false;
		}

		function getAvailablePlaybackRates(): number[] {
			return [1];
		}

		return {
			isBuffering,

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

export default VimeoPlayer;
</script>

<style lang="scss" scoped>
.vimeo {
	color: #696969;
}
</style>
