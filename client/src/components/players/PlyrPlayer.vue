<template>
	<div class="direct">
		<video id="directplayer"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import Plyr from "plyr";
import Hls from "hls.js";

export default defineComponent({
	name: "PlyrPlayer",
	props: {
		videoUrl: { type: String, required: true },
		videoMime: { type: String, required: true },
		thumbnail: { type: String },
	},
	emits: [
		"apiready",
		"ready",
		"playing",
		"paused",
		"waiting",
		"buffering",
		"error",
		"end",
		"buffer-progress",
		"buffer-spans",
	],
	setup(props, { emit }) {
		const { videoUrl, videoMime, thumbnail } = toRefs(props);
		const videoElem = ref<HTMLVideoElement | undefined>();
		const player = ref<Plyr | undefined>();

		function play() {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			return player.value.play();
		}

		function pause() {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			return player.value.pause();
		}

		function setVolume(volume: number) {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			player.value.volume = volume / 100;
		}

		function getPosition() {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			return player.value.currentTime;
		}

		function setPosition(position: number) {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			player.value.currentTime = position;
		}

		function isCaptionsSupported() {
			return false;
		}

		function getAvailablePlaybackRates() {
			return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
		}

		async function getPlaybackRate(): Promise<number> {
			if (!player.value) {
				console.error("player not ready");
				return 1;
			}
			return player.value.speed;
		}

		async function setPlaybackRate(rate: number): Promise<void> {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			player.value.speed = rate;
		}

		onMounted(() => {
			videoElem.value = document.getElementById("directplayer") as HTMLVideoElement;
			player.value = new Plyr(videoElem.value, {
				controls: [],
				clickToPlay: false,
				keyboard: {
					focused: false,
					global: false,
				},
				disableContextMenu: false,
				fullscreen: {
					enabled: false,
				},
			});
			emit("apiready");

			player.value.on("ready", () => emit("ready"));
			player.value.on("ended", () => emit("end"));
			player.value.on("playing", () => emit("playing"));
			player.value.on("pause", () => emit("paused"));
			player.value.on("play", () => emit("waiting"));
			player.value.on("stalled", () => emit("buffering"));
			player.value.on("loadstart", () => emit("buffering"));
			player.value.on("canplay", () => emit("ready"));
			player.value.on("progress", () => {
				if (!player.value) {
					return;
				}
				emit("buffer-progress", player.value.buffered);
			});
			player.value.on("error", err => {
				emit("error");
				console.error("PlyrPlayer: error:", err);
			});

			loadVideoSource();
		});
		onBeforeUnmount(() => {
			if (player.value) {
				player.value.destroy();
			}
		});

		function loadVideoSource() {
			console.log("PlyrPlayer: loading video source:", videoUrl.value, videoMime.value);
			if (!player.value) {
				console.error("player not ready");
				return;
			}

			if (videoMime.value === "application/x-mpegURL") {
				if (!videoElem.value) {
					console.error("video element not ready");
					return;
				}
				// HACK: force the video element to be recreated...
				player.value.source = {
					type: "video",
					sources: [],
					poster: thumbnail.value,
				};
				videoElem.value = document.querySelector("video") as HTMLVideoElement;
				// ...so that we can use hls.js to change the video source
				const hls = new Hls();
				hls.loadSource(videoUrl.value);
				hls.attachMedia(videoElem.value);
			} else {
				player.value.source = {
					sources: [
						{
							src: videoUrl.value,
							type: videoMime.value,
						},
					],
					type: "video",
					poster: thumbnail.value,
				};
			}
			player.value.play();
		}

		watch(videoUrl, () => {
			console.log("PlyrPlayer: videoUrl changed");
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			loadVideoSource();
		});

		return {
			player,
			play,
			pause,
			setVolume,
			getPosition,
			setPosition,
			isCaptionsSupported,
			getAvailablePlaybackRates,
			getPlaybackRate,
			setPlaybackRate,
		};
	},
});
</script>

<style lang="scss">
.direct,
.plyr {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
}

.plyr__video-wrapper {
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
}

.direct video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: 50% 50%;
}
</style>
