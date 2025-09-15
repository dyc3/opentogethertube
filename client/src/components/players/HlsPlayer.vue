<template>
	<div class="hls">
		<video id="hlsplayer" preload="auto"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import Hls from "hls.js";
import type { MediaPlayerWithCaptions, MediaPlayerWithPlaybackRate } from "../composables";
import { useCaptions } from "../composables";

export default defineComponent({
	name: "HlsPlayer",
	props: {
		videoUrl: { type: String, required: true },
		thumbnail: { type: String },
	},
	emits: [
		"apiready",
		"ready",
		"playing",
		"paused",
		"buffering",
		"error",
		"end",
		"buffer-progress",
		"buffer-spans",
	],
	setup(props, { emit }) {
		const { videoUrl, thumbnail } = toRefs(props);
		const videoElem = ref<HTMLVideoElement | undefined>();
		let hls: Hls | undefined = undefined;

		const playerImpl: MediaPlayerWithCaptions & MediaPlayerWithPlaybackRate = {
			play() {
				if (!videoElem.value) {
					console.error("player not ready");
					return;
				}
				return videoElem.value.play();
			},
			pause() {
				if (!videoElem.value) {
					console.error("player not ready");
					return;
				}
				videoElem.value.pause();
			},
			setVolume(volume: number) {
				if (!videoElem.value) {
					console.error("player not ready");
					return;
				}
				videoElem.value.volume = volume / 100;
			},
			getPosition() {
				if (!videoElem.value) {
					console.error("player not ready");
					return 0;
				}
				return videoElem.value.currentTime;
			},
			setPosition(position: number) {
				if (!videoElem.value) {
					console.error("player not ready");
					return;
				}
				videoElem.value.currentTime = position;
			},

			isCaptionsSupported(): boolean {
				return true;
			},
			setCaptionsEnabled(enabled: boolean): void {
				if (!hls) {
					return;
				}
				if (enabled === false) {
					hls.subtitleTrack = -1;
				}
			},
			isCaptionsEnabled(): boolean {
				if (!hls) {
					return false;
				}
				return hls.subtitleTrack !== -1;
			},
			getCaptionsTracks(): string[] {
				console.log("HlsPlayer: getCaptionsTracks:", hls?.subtitleTracks);
				return hls?.subtitleTracks.map(track => track.name) || [];
			},
			setCaptionsTrack(track: string): void {
				if (!hls) {
					console.error("HlsPlayer: player not ready");
					return;
				}
				console.log("HlsPlayer: setCaptionsTrack:", track);
				const trackIdx = hls.subtitleTracks.findIndex(t => t.name === track);
				if (trackIdx === -1) {
					console.error("HlsPlayer: HLS.js captions track not found:", track);
					return;
				}
				console.log("HlsPlayer: setting HLS.js captions track:", trackIdx);
				hls.subtitleTrack = trackIdx;
			},

			getAvailablePlaybackRates(): number[] {
				return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
			},
			getPlaybackRate(): number {
				if (!videoElem.value) {
					console.error("player not ready");
					return 1;
				}
				return videoElem.value.playbackRate;
			},
			async setPlaybackRate(rate: number): Promise<void> {
				if (!videoElem.value) {
					console.error("player not ready");
					return;
				}
				videoElem.value.playbackRate = rate;
			},
		};

		const captions = useCaptions();
		onMounted(() => {
			videoElem.value = document.getElementById("hlsplayer") as HTMLVideoElement;
			if (!videoElem.value) {
				console.error("HLS player video element not found");
				return;
			}

			// Set up video element event listeners
			videoElem.value.addEventListener("ready", () => emit("ready"));
			videoElem.value.addEventListener("canplay", () => emit("ready"));
			videoElem.value.addEventListener("playing", () => emit("playing"));
			videoElem.value.addEventListener("pause", () => emit("paused"));
			videoElem.value.addEventListener("stalled", () => emit("buffering"));
			videoElem.value.addEventListener("loadstart", () => emit("buffering"));
			videoElem.value.addEventListener("progress", () => {
				if (videoElem.value) {
					const buffered = videoElem.value.buffered;
					emit("buffer-spans", buffered);

					const duration = videoElem.value.duration;
					const bufferedPercentage =
						buffered && buffered.length && duration > 0
							? buffered.end(0) / duration
							: 0;
					emit("buffer-progress", bufferedPercentage);
				}
			});
			videoElem.value.addEventListener("ended", () => emit("end"));
			videoElem.value.addEventListener("error", err => {
				emit("error");
				console.error("HlsPlayer: video element error:", err);
			});

			loadVideoSource();
		});
		onBeforeUnmount(() => {
			hls?.destroy();
		});

		function loadVideoSource() {
			console.log("HlsPlayer: loading video source:", videoUrl.value);

			if (!videoElem.value) {
				console.error("video element not ready");
				return;
			}

			hls?.destroy();
			hls = undefined;

			videoElem.value.setAttribute("crossorigin", "anonymous"); // For WebVTT captions
			videoElem.value.setAttribute("poster", thumbnail.value || "");

			hls = new Hls();

			hls.loadSource(videoUrl.value);
			hls.attachMedia(videoElem.value);

			hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
				console.info("HlsPlayer: hls.js manifest parsed", data);
				emit("ready");
			});

			hls.on(Hls.Events.ERROR, (event, data) => {
				console.error("HlsPlayer: hls.js error:", event, data);
				console.error("HlsPlayer: hls.js inner error:", data.error);
				emit("error");
			});

			hls.on(Hls.Events.INIT_PTS_FOUND, () => {
				console.info("HlsPlayer: hls.js init pts found");
				captions.captionsTracks.value = playerImpl.getCaptionsTracks();
				captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				console.log("HlsPlayer: current subtitle track:", hls?.subtitleTrack);
				captions.currentTrack.value =
					captions.captionsTracks.value[hls?.subtitleTrack || 0] || "";
			});

			hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, (_, data) => {
				console.info("HlsPlayer: hls.js subtitle track loaded:", data);
			});

			hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
				console.info("HlsPlayer: hls.js subtitle track switched:", data);
			});

			// this is needed to get the player to keep playing after the previous video has ended
			videoElem.value.play();

			emit("apiready");
		}

		watch(videoUrl, () => {
			console.log("HlsPlayer: videoUrl changed");
			loadVideoSource();
		});

		return {
			...playerImpl,
		};
	},
});
</script>

<style lang="scss">
.hls {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
}

.hls video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: 50% 50%;
}
</style>
