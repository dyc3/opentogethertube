<template>
	<div class="generichls">
		<video id="generichlsplayer" class="video-js vjs-default-skin"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onBeforeUnmount, ref, toRefs, watch } from "vue";
import videojs, { VideoJsPlayer } from "video.js";

export default defineComponent({
	name: "GenericHlsPlayer",
	props: {
		videoid: { type: String, required: true },
		hlsUrl: { type: String, required: true },
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
		const { videoid, hlsUrl, thumbnail } = toRefs(props);
		const player = ref<VideoJsPlayer | undefined>();
		let hasEmittedApiReady = false;

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
			return player.value.volume(volume / 100);
		}

		function getPosition() {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			return player.value.currentTime();
		}

		function setPosition(position: number) {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			return player.value.currentTime(position);
		}

		function isCaptionsSupported() {
			return false;
		}

		function getAvailablePlaybackRates() {
			return [1];
		}

		function loadVideoSource() {
			console.log("GenericHlsPlayer: loading video source:", hlsUrl.value);

			if (!player.value) {
				console.error("player not ready");
				return;
			}

			player.value.reset();
			player.value.loadMedia(
				{
					src: {
						src: hlsUrl.value,
						type: "application/x-mpegurl",
					},
					poster: thumbnail.value,
				},
				() => {
					emit("ready");
					play();
				}
			);
		}

		function beginNewVideo() {
			const element = document.getElementById("generichlsplayer");
			if (!element) {
				console.error("GenericHlsPlayer: element not found");
				return;
			}
			player.value = videojs(element, {
				controls: false,
				responsive: true,
				loop: false,
				preload: "auto",
				poster: thumbnail.value,
			});
			// required for iOS
			// player.value.setPlaysinline(true);
			if (!hasEmittedApiReady) {
				emit("apiready");
				hasEmittedApiReady = true;
			}
			if (import.meta.env.NODE_ENV === "development") {
				for (const event of [
					"ready",
					"loadstart",
					"suspend",
					"abort",
					"error",
					"emptied",
					"stalled",
					"loadedmetadata",
					"loadeddata",
					"canplay",
					"playing",
					"waiting",
					"seeking",
					"seeked",
					"ended",
					"durationchange",
					"progress",
					"play",
					"pause",
					"ratechange",
				]) {
					player.value.on(event, () => console.log("GenericHlsPlayer event:", event));
				}
				videojs.log.level("debug");
			}
			player.value.on("ready", () => emit("ready"));
			player.value.on("ended", () => emit("end"));
			player.value.on("ended", onVideoEnd);
			player.value.on("playing", () => emit("playing"));
			player.value.on("pause", () => emit("paused"));
			player.value.on("play", () => emit("waiting"));
			player.value.on("stalled", () => emit("buffering"));
			player.value.on("loadstart", () => emit("buffering"));
			player.value.on("canplay", () => emit("ready"));
			player.value.on("error", () => emit("error"));
			player.value.on("progress", () => {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				emit("buffer-progress", player.value.bufferedPercent());
				emit("buffer-spans", player.value.buffered());
			});
			loadVideoSource();
		}
		function onVideoEnd() {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			player.value.reset();
		}

		onMounted(beginNewVideo);
		onBeforeUnmount(() => {
			if (player.value) {
				player.value.dispose();
			}
		});

		watch(props, () => {
			if (!player.value) {
				console.error("player not ready");
				return;
			}
			player.value.reset();
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
		};
	},
});
</script>

<style lang="scss" scoped>
@import url("https://vjs.zencdn.net/5.4.6/video-js.min.css");

.video-js {
	width: 100%;
	height: 100%;
}
</style>
