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

		// Treat both "subtitles" and "captions" as valid CC kinds (dash.js usually uses "subtitles").
		function isCaptionKind(kind?: string | null): boolean {
			return kind === "captions" || kind === "subtitles";
		}

		// Short-hands to avoid repeating optional chaining everywhere.
		const tt = () => videoElem.value?.textTracks ?? ({} as TextTrackList);

		// Helper: pick a safe caption index (prefer currently showing, else first available)
		function pickCaptionIdx(): number {
			const showing = showingCaptionIdx();
			return showing >= 0 ? showing : firstCaptionTrackIdx();
		}

		// Ensure Plyr overlay & native track mode are changed coherently.
		// If `idx` is provided, we normalize Plyr.currentTrack to that before toggling.
		function safeToggleCaptions(enabled: boolean, idx?: number): void {
			if (!player.value || !hasCaptionTracks()) {
				return;
			}
			try {
				if (enabled) {
					const use = typeof idx === "number" && idx >= 0 ? idx : pickCaptionIdx();
					if (use < 0) {
						return;
					} // no valid track yet; avoid toggling Plyr to prevent errors
					try {
						// Normalize Plyr's notion of the current track.
						(player.value as any).currentTrack = use;
					} catch (e) {
						console.warn("PlyrPlayer: could not set currentTrack on Plyr", e);
					}
					try {
						// Ensure native track actually renders.
						(tt() as any)[use].mode = "showing";
					} catch (e) {
						console.error("PlyrPlayer: failed to set text track mode to 'showing'", e);
					}
				} else {
					try {
						(player.value as any).currentTrack = -1;
					} catch (e) {
						console.warn("PlyrPlayer: could not clear currentTrack on Plyr", e);
					}
				}
				player.value.toggleCaptions(enabled);
			} catch (e) {
				console.warn("PlyrPlayer: toggleCaptions skipped:", e);
			}
		}

		// Return true if the <video> currently has any caption/subtitle TextTracks.
		function hasCaptionTracks(): boolean {
			const list = videoElem.value?.textTracks;
			if (!list) {
				return false;
			}
			// Snapshot length to avoid live-list races.
			const len = list.length;
			for (let i = 0; i < len; i++) {
				const t = (list as any)[i] as TextTrack | undefined;
				if (t && isCaptionKind(t.kind)) {
					return true;
				}
			}
			return false;
		}

		function showingCaptionIdx(): number {
			for (let i = 0; i < tt().length; i++) {
				const t = tt()[i];
				if (t && isCaptionKind(t.kind) && t.mode === "showing") {
					return i;
				}
			}
			return -1;
		}

		function firstCaptionTrackIdx(): number {
			for (let i = 0; i < tt().length; i++) {
				if (isCaptionKind(tt()[i]?.kind)) {
					return i;
				}
			}
			return -1; // -1 disables captions in dash.js, also signals "none found" here
		}

		function findTrackIdx(language: string): number {
			for (let i = 0; i < tt().length; i++) {
				const track = tt()[i];
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
				return ["direct", "hls", "dash"].includes(props.service);
			},
			setCaptionsEnabled(enabled: boolean): void {
				if (hls) {
					hls.subtitleDisplay = enabled;
				} else if (dash) {
					if (enabled) {
						// Select a concrete text track first, then normalize Plyr + native mode, then toggle overlay.
						const idx = pickCaptionIdx();
						dash.setTextTrack(idx >= 0 ? idx : -1);
						if (idx >= 0) {
							safeToggleCaptions(true, idx);
						}
					} else {
						dash.setTextTrack(-1);
						safeToggleCaptions(false);
					}
				} else {
					// direct (MP4, etc.)
					safeToggleCaptions(enabled);
				}
			},
			isCaptionsEnabled(): boolean {
				if (hls) {
					return hls.subtitleDisplay;
				}
				// DASH/native fallback: true if any caption track is "showing"
				if (dash) {
					return showingCaptionIdx() >= 0;
				}
				// Plyr fallback (native)
				return (player.value?.currentTrack ?? -1) !== -1;
			},
			getCaptionsTracks(): string[] {
				const langs: string[] = [];
				const list = videoElem.value?.textTracks;
				if (!list) {
					return langs;
				}
				const len = list.length;
				for (let i = 0; i < len; i++) {
					const t: TextTrack | null | undefined =
						typeof (list as any).item === "function"
							? (list as any).item(i)
							: (list as any)[i];
					if (!t || !isCaptionKind(t.kind)) {
						continue;
					}
					langs.push(t.language || "");
				}
				return langs;
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
					if (idx < 0) {
						idx = firstCaptionTrackIdx();
					}
					dash.setTextTrack(idx >= 0 ? idx : -1); // -1 disables
					if (idx >= 0) {
						safeToggleCaptions(true, idx);
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

		const captions = useCaptions();
		onMounted(() => {
			videoElem.value = document.getElementById("directplayer") as HTMLVideoElement;
			player.value = new Plyr(videoElem.value, {
				controls: [],
				clickToPlay: false,
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

				dash = dashjs.MediaPlayer().create();
				// HACK: force the video element to be recreated...
				player.value.source = {
					type: "video",
					sources: [],
					poster: thumbnail.value,
				};
				// Acquire the freshly recreated <video> and set CORS on THAT element.
				videoElem.value = document.querySelector("video") as HTMLVideoElement;

				// Allow cross-origin WebVTT fetched by dash.js.
				(videoElem.value as HTMLVideoElement).crossOrigin = "anonymous";

				// ...so that we can use dash.js to change the video source
				dash.initialize(videoElem.value, videoUrl.value, false);

				// Update: hook into dash.js caption-related events to keep the store in sync.
				const D = dashjs.MediaPlayer.events;

				// Small util to keep store + overlay up to date.
				const syncCaptions = () => {
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				};

				// Fired when MPD is ready; text tracks may come slightly later, so also listen for TEXT_TRACK(S)_ADDED.
				dash.on("manifestLoaded", () => {
					console.info("PlyrPlayer: dash.js manifest loaded");
					emit("ready");
					syncCaptions();
				});
				dash.on(D.TEXT_TRACKS_ADDED ?? "allTextTracksAdded", () => {
					// Tracks just arrived: keep store in sync and, if captions should be on,
					// select a valid track and enable the overlay now.
					syncCaptions();
					if (captions.isCaptionsEnabled.value && hasCaptionTracks()) {
						const idx = pickCaptionIdx();
						if (idx >= 0) {
							dash?.setTextTrack(idx);
							safeToggleCaptions(true, idx);
						}
					}
				});
				dash.on(D.TEXT_TRACK_ADDED ?? "textTrackAdded", () => {
					// Same as above for engines that emit per-track.
					syncCaptions();
					if (captions.isCaptionsEnabled.value && hasCaptionTracks()) {
						const idx = pickCaptionIdx();
						if (idx >= 0) {
							dash?.setTextTrack(idx);
							safeToggleCaptions(true, idx);
						}
					}
				});
				dash.on("streamInitialized", () => {
					if (captions.isCaptionsEnabled.value) {
						const idx = pickCaptionIdx();
						if (idx >= 0) {
							dash?.setTextTrack(idx);
							safeToggleCaptions(true, idx);
						}
					} else {
						dash?.setTextTrack(-1);
						safeToggleCaptions(false);
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
