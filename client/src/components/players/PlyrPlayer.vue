<template>
	<div class="direct" :style="{ '--captions-bottom': captionsBottom }">
		<video id="directplayer" preload="auto"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, onBeforeUnmount, toRefs, computed } from "vue";
import Plyr from "plyr";
import Hls from "hls.js";
import dashjs from "dashjs";
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
		captionsOffset: { type: Number, default: 56 }, // px
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
		let hls: Hls | undefined = undefined;
		let dash: dashjs.MediaPlayerClass | undefined = undefined;

		const captionsBottom = computed(() => `${props.captionsOffset}px`);

		// Helper: find first caption track index on the <video> element.
		// Reason: For DASH we may need to "enable captions" by selecting any valid text track.

		// Treat both "subtitles" and "captions" as valid CC kinds (dash.js usually uses "subtitles").
		function isCaptionKind(kind?: string | null): boolean {
			return kind === "captions" || kind === "subtitles";
		}
		function firstCaptionTrackIdx(): number {
			for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
				const t = videoElem.value!.textTracks[i];
				if (isCaptionKind(t?.kind)) return i;
			}
			return -1; // -1 disables captions in dash.js, also signals "none found" here
		}

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
				// old: return ["direct", "hls"].includes(props.service);
				return ["direct", "hls", "dash"].includes(props.service);
			},
			setCaptionsEnabled(enabled: boolean): void {
				if (hls) {
					hls.subtitleDisplay = enabled;
					// DASH: select a valid text track (>=0) to show, or -1 to hide
				} else if (dash) {
					player.value?.toggleCaptions(enabled);
					// If enabling, pick currently selected track if any “showing”, else first available caption track.
					if (enabled) {
						const current = (() => {
							for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
								const t = videoElem.value!.textTracks[i];
								if (t && t.kind === "captions" && t.mode === "showing") return i;
							}
							return firstCaptionTrackIdx();
						})();
						dash.setTextTrack(current >= 0 ? current : -1);
						if (current >= 0) {
							try {
								videoElem.value!.textTracks[current].mode = "showing";
							} catch (e) {
								console.error(String(e));
							}
						}
					} else {
						dash.setTextTrack(-1);
					}
				} else {
					player.value?.toggleCaptions(enabled);
				}
			},
			isCaptionsEnabled(): boolean {
				if (hls) {
					return hls.subtitleDisplay;
				}
				// DASH/native fallback: check if any caption track is currently "showing"
				for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
					const t = videoElem.value!.textTracks[i];
					if (t && isCaptionKind(t.kind) && t.mode === "showing") return true;
				}
				// Plyr fallback (native)
				return (player.value?.currentTrack ?? -1) !== -1;
			},
			getCaptionsTracks(): string[] {
				const tracks: string[] = [];
				for (let i = 0; i < (videoElem.value?.textTracks?.length ?? 0); i++) {
					const track = videoElem.value?.textTracks[i];
					if (!track || !isCaptionKind(track.kind)) {
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
				if (hls) {
					hls.subtitleTrack = findTrackIdx(track);
				}
				// DASH: switch via dash.js API (uses same track index order as video.textTracks)
				else if (dash) {
					let idx = findTrackIdx(track);
					// If not found, fall back to first available subtitle/caption to at least show text.
					if (idx < 0) idx = firstCaptionTrackIdx();
					dash.setTextTrack(idx >= 0 ? idx : -1); // -1 disables
					// Ensure overlay + native track mode are aligned so text actually renders.
					if (idx >= 0) {
						player.value?.toggleCaptions(true);
						try {
							videoElem.value!.textTracks[idx].mode = "showing";
						} catch (e) {
							console.error(String(e));
						}
					}
				} else {
					player.value.currentTrack = findTrackIdx(track);
				}
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
				if (!track || !isCaptionKind(track.kind)) {
					continue;
				}
				// Be lenient: dash.js may expose "en", "en-US", etc.
				if (
					track.language === language ||
					(track.language &&
						language &&
						track.language.toLowerCase().startsWith(language.toLowerCase()))
				) {
					return i;
				}
			}
			return -1;
		}

		const captions = useCaptions();
		onMounted(() => {
			videoElem.value = document.getElementById("directplayer") as HTMLVideoElement;
			player.value = new Plyr(videoElem.value, {
				controls: [],
				clickToPlay: false,
				// Ensure Plyr’s caption overlay is available.
				// NOTE: With DASH we switch tracks via dash.js, but Plyr still needs its overlay “active”
				// to actually render native text tracks on top of the video.
				captions: {
					active: false, // we’ll toggle this dynamically in setCaptionsEnabled / stream init
					update: true,
				},
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
			hls?.destroy();
			dash?.reset();
		});

		function loadVideoSource() {
			console.log("PlyrPlayer: loading video source:", videoUrl.value, videoMime.value);
			if (!player.value) {
				console.error("player not ready");
				return;
			}

			hls?.destroy();
			hls = undefined;
			dash?.reset();
			dash = undefined;

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
				hls = new Hls();
				hls.loadSource(videoUrl.value);
				hls.attachMedia(videoElem.value);
				hls.on(Hls.Events.MANIFEST_PARSED, () => {
					console.info("PlyrPlayer: hls.js manifest parsed");
					emit("ready");
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				hls.on(Hls.Events.ERROR, (event, data) => {
					console.error("PlyrPlayer: hls.js error:", event, data);
					console.error("PlyrPlayer: hls.js inner error:", data.error);
					emit("error");
				});
				hls.on(Hls.Events.INIT_PTS_FOUND, () => {
					console.info("PlyrPlayer: hls.js init pts found");
				});
				hls.on(Hls.Events.KEY_LOADING, () => {
					console.info("PlyrPlayer: hls.js key loading");
				});
				hls.on(Hls.Events.KEY_LOADED, () => {
					console.info("PlyrPlayer: hls.js key loaded");
				});
			} else if (videoMime.value === "application/dash+xml") {
				if (!videoElem.value) {
					console.error("video element not ready");
					return;
				}
				try {
					(videoElem.value as HTMLVideoElement).crossOrigin = "anonymous";
				} catch (e) {
					console.error(String(e));
				}
				dash = dashjs.MediaPlayer().create();
				// HACK: force the video element to be recreated...
				player.value.source = {
					type: "video",
					sources: [],
					poster: thumbnail.value,
				};
				videoElem.value = document.querySelector("video") as HTMLVideoElement;
				// ...so that we can use dash.js to change the video source
				dash.initialize(videoElem.value, videoUrl.value, false);

				// Update: hook into dash.js caption-related events to keep the store in sync.
				const D = dashjs.MediaPlayer.events;

				// Fired when MPD is ready; text tracks may come slightly later, so also listen for TEXT_TRACK(S)_ADDED.
				dash.on("manifestLoaded", () => {
					console.info("PlyrPlayer: dash.js manifest loaded");
					emit("ready");
					if (player.value) {
						player.value.toggleCaptions(!!captions.isCaptionsEnabled.value);
					}
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				// Fired once all text tracks found in MPD are added to the element (dash v4+ name below)
				// Ref: dash.js docs – setTextTrack / TEXT_TRACK(S)_ADDED
				// This keeps the captions track list reactive for DASH like we do for HLS.
				dash.on((D as any).TEXT_TRACKS_ADDED ?? "allTextTracksAdded", () => {
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				// Additionally react to single track additions (older/newer variants)
				dash.on((D as any).TEXT_TRACK_ADDED ?? "textTrackAdded", () => {
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				// Optional: ensure captions default visibility mirrors our store upon stream init
				dash.on("streamInitialized", () => {
					if (player.value) {
						player.value.toggleCaptions(!!captions.isCaptionsEnabled.value);
					}
					// If store says captions should be on, select a valid track; otherwise ensure off.
					if (captions.isCaptionsEnabled.value) {
						const idx = firstCaptionTrackIdx();
						if (idx >= 0) dash?.setTextTrack(idx);
					} else {
						dash?.setTextTrack(-1);
					}
				});
				dash.on("error", (event: unknown) => {
					console.error("PlyrPlayer: dash.js error:", event);
					emit("error");
				});
				dash.on("playbackError", (event: unknown) => {
					console.error("PlyrPlayer: dash.js playback error:", event);
					emit("error");
				});
				dash.on("streamInitialized", () => {
					console.info("PlyrPlayer: dash.js stream initialized");
				});
				dash.on("bufferStalled", () => {
					console.info("PlyrPlayer: dash.js buffer stalled");
					emit("buffering");
				});
				dash.on("bufferLoaded", () => {
					console.info("PlyrPlayer: dash.js buffer loaded");
					emit("ready");
				});
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
				videoElem.value = document.querySelector("video") as HTMLVideoElement;
			}
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
			captionsBottom,
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

.plyr__captions {
	bottom: calc(var(--captions-bottom, 56px) + env(safe-area-inset-bottom));
}

.plyr__captions .plyr__caption {
	max-width: 92%;
}
</style>
