<template>
	<div class="direct">
		<video id="directplayer" preload="auto"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import Plyr from "plyr";
import "plyr/src/sass/plyr.scss";
import type { MediaPlayerWithCaptions, MediaPlayerWithPlaybackRate } from "../composables";
import { useCaptions } from "../composables";

export default defineComponent({
	name: "PlyrPlayer",
	props: {
		service: { type: String, required: true },
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

		const playerImpl: MediaPlayerWithCaptions & MediaPlayerWithPlaybackRate = {
			play() {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				return player.value.play();
			},
			pause() {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				return player.value.pause();
			},
			setVolume(volume: number) {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				player.value.volume = volume / 100;
			},
			getPosition() {
				if (!player.value) {
					console.error("player not ready");
					return 0;
				}
				return player.value.currentTime;
			},
			setPosition(position: number) {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				player.value.currentTime = position;
			},

			isCaptionsSupported(): boolean {
				return ["direct"].includes(props.service);
			},
			setCaptionsEnabled(enabled: boolean): void {
				player.value?.toggleCaptions(enabled);
			},
			isCaptionsEnabled(): boolean {
				return player.value?.currentTrack !== -1;
			},
			getCaptionsTracks(): string[] {
				const tracks: string[] = [];
				for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
					const track = videoElem.value?.textTracks[i];
					if (!track || track.kind !== "captions") {
						continue;
					}
					tracks.push(track.language);
				}
				return tracks;
			},
			setCaptionsTrack(track: string): void {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				console.log("PlyrPlayer: setCaptionsTrack:", track);
				player.value.currentTrack = findTrackIdx(track);
			},

			isQualitySupported(): boolean {
				return false;
			},

			getAvailablePlaybackRates(): number[] {
				return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
			},
			getPlaybackRate(): number {
				if (!player.value) {
					console.error("player not ready");
					return 1;
				}
				return player.value.speed;
			},
			async setPlaybackRate(rate: number): Promise<void> {
				if (!player.value) {
					console.error("player not ready");
					return;
				}
				player.value.speed = rate;
			},
		};

		function findTrackIdx(language: string): number {
			for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
				const track = videoElem.value?.textTracks[i];
				if (!track || track.kind !== "captions") {
					continue;
				}
				if (track.language === language) {
					return i;
				}
			}
			return 0;
		}

		const captions = useCaptions();
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

			player.value.on("ready", () => emit("ready"));
			player.value.on("ended", () => emit("end"));
			player.value.on("playing", () => emit("playing"));
			player.value.on("pause", () => emit("paused"));
			player.value.on("play", () => emit("waiting"));
			player.value.on("stalled", () => emit("buffering"));
			player.value.on("loadstart", () => emit("buffering"));
			player.value.on("canplay", () => {
				emit("ready");
				captions.captionsTracks.value = playerImpl.getCaptionsTracks();
			});
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
			player.value?.destroy();
		});

		function loadVideoSource() {
			console.log("PlyrPlayer: loading video source:", videoUrl.value, videoMime.value);
			if (!player.value) {
				console.error("player not ready");
				return;
			}

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
			videoElem.value = document.querySelector("video") as HTMLVideoElement;

			// this is needed to get the player to keep playing after the previous video has ended
			player.value.play();

			if (videoElem.value) {
				videoElem.value.addEventListener("progress", () => {
					if (player.value) {
						emit("buffer-progress", player.value.buffered);
					}
					if (videoElem.value) {
						emit("buffer-spans", videoElem.value.buffered);
					}
				});
				videoElem.value.addEventListener("loadstart", () => {
					console.debug("PlyrPlayer: video loadstart");
					emit("buffering");
				});
				videoElem.value.addEventListener("waiting", () => {
					console.debug("PlyrPlayer: video waiting");
				});
				videoElem.value.addEventListener("stalled", () => {
					console.debug("PlyrPlayer: video stalled");
					emit("buffering");
				});
				videoElem.value.addEventListener("canplay", () => {
					console.debug("PlyrPlayer: video canplay");
				});
			} else {
				console.error("video element not present");
			}

			emit("apiready");
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
			...playerImpl,
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
