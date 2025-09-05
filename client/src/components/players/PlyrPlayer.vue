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
		let hoverContainer: HTMLElement | undefined;

		const captionsBottom = computed(() => `${props.captionsOffset}px`);

		// Treat both "subtitles" and "captions" as valid CC kinds (dash.js usually uses "subtitles"). But some XML expose one or both.
		function isCaptionKind(kind?: string | null): boolean {
			return kind === "captions" || kind === "subtitles";
		}

		type MutablePlyr = Plyr & { currentTrack: number };
		type CaptionEntry = { track: TextTrack; idx: number };

		type PlyrWithCaptionsInternals = Plyr & {
			captions?: { getTracks?: () => unknown[] };
		};

		function hasValidPlyrTracks(): boolean {
			const p = player.value as PlyrWithCaptionsInternals | undefined;
			if (!p?.captions?.getTracks) return false;
			try {
				const tracks = p.captions.getTracks();
				return (
					Array.isArray(tracks) &&
					tracks.length > 0 &&
					tracks.every(t => t && typeof t === "object" && "language" in (t as any))
				);
			} catch {
				return false;
			}
		}

		function pickCaptionIdx(): number {
			const showing = showingCaptionIdx();
			return showing >= 0 ? showing : firstCaptionTrackIdx();
		}

		function hasPlyrCaptionTracks(): boolean {
			const p = player.value as PlyrWithCaptionsInternals | undefined;
			if (!p?.captions?.getTracks) {
				return false;
			}
			try {
				const tracks = p.captions.getTracks();
				return Array.isArray(tracks) && tracks.length > 0;
			} catch {
				return false;
			}
		}

		function safeToggleCaptions(enabled: boolean, idx?: number): void {
			const entries = captionEntries();
			if (!player.value || entries.length === 0 || !hasValidPlyrTracks()) {
				return;
			}
			try {
				if (enabled) {
					const use = typeof idx === "number" && idx >= 0 ? idx : pickCaptionIdx();
					if (use < 0) {
						return;
					}
					(player.value as MutablePlyr).currentTrack = use;
					const chosen = entries.find(e => e.idx === use);
					if (chosen) {
						chosen.track.mode = "showing";
					}
				} else {
					(player.value as MutablePlyr).currentTrack = -1;
				}
				player.value?.toggleCaptions(enabled);
			} catch (e) {
				console.debug("PlyrPlayer: toggleCaptions skipped (not ready):", e);
			}
		}

		function captionEntries(): CaptionEntry[] {
			const list = videoElem.value?.textTracks;
			const out: CaptionEntry[] = [];
			if (!list) {
				return out;
			}
			const len = list.length;
			for (let i = 0; i < len; i++) {
				// Access by numeric index, fallback to .item() for broader browser compat.
				const byIndex = (list as unknown as { [n: number]: TextTrack | undefined })[i];
				const viaItem =
					(list as unknown as { item?: (n: number) => TextTrack | null }).item?.call(
						list,
						i
					) ?? undefined;
				const t = byIndex ?? viaItem;
				if (t && isCaptionKind(t.kind)) {
					out.push({ track: t, idx: i });
				}
			}
			return out;
		}

		let overlayRetry = 0;
		function forcePlyrOverlay() {
			const list = videoElem.value?.textTracks;
			if (list) {
				for (let i = 0; i < list.length; i++) {
					const t = (list as unknown as { [n: number]: TextTrack | undefined })[i];
					if (t && isCaptionKind(t.kind)) t.mode = "hidden"; // never show native cues
				}
			}
			try {
				player.value?.toggleCaptions(true); // enable Plyr overlay
				overlayRetry = 0;
			} catch {
				// Tracks may not be ready yet (common in Firefox) – retry briefly.
				if (overlayRetry < 10) {
					overlayRetry++;
					setTimeout(forcePlyrOverlay, 50);
				} else {
					overlayRetry = 0;
				}
			}
		}

		function getContainer(): HTMLElement | undefined {
			const el = videoElem.value?.closest(".plyr");
			return el instanceof HTMLElement ? el : undefined;
		}

		function getControls(): HTMLElement | undefined {
			const container = getContainer();
			const el = container?.querySelector<HTMLElement>(".plyr__controls") ?? null;
			return el ?? undefined;
		}

		function getCaptionsEl(): HTMLElement | undefined {
			return getContainer()?.querySelector<HTMLElement>(".plyr__captions") ?? undefined;
		}

		function controlsPixelHeight(): number {
			const controls = getControls();
			if (!controls) return 0;
			return Math.ceil(controls.getBoundingClientRect().height || 0) + 10;
		}

		function applyControlsOffset(visible: boolean) {
			const container = getContainer();
			const captionsEl = getCaptionsEl();
			if (!container && !captionsEl) return;
			const DEFAULT_CTRL_H = 64;
			const measured = controlsPixelHeight();
			const h = visible ? measured || DEFAULT_CTRL_H : 0;
			const extra = visible ? props.captionsOffset ?? 56 : 0;
			const value = `calc(${16 + extra}px + ${h}px + env(safe-area-inset-bottom))`;
			if (captionsEl) {
				captionsEl.style.bottom = value;
				if (!visible) captionsEl.style.removeProperty("transform");
			}
			container?.style.setProperty("--captions-bottom", value);
			captionsEl?.style.setProperty("--captions-bottom", value);
		}

		function hasCaptionTracks(): boolean {
			return captionEntries().length > 0;
		}

		function showingCaptionIdx(): number {
			const e = captionEntries().find(e => e.track.mode === "showing");
			return e ? e.idx : -1;
		}

		function firstCaptionTrackIdx(): number {
			const e = captionEntries()[0];
			return e ? e.idx : -1;
		}

		function findTrackIdx(language: string): number {
			const e = captionEntries().find(
				e =>
					e.track.language === language ||
					(!!e.track.language &&
						!!language &&
						e.track.language.toLowerCase().startsWith(language.toLowerCase()))
			);
			return e ? e.idx : -1;
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
					if (hasValidPlyrTracks()) {
						safeToggleCaptions(enabled);
					} else {
						for (const e of captionEntries()) {
							e.track.mode = enabled ? "showing" : "hidden";
						}
					}
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
				// Native vs. Plyr-Overlay
				return hasValidPlyrTracks()
					? (player.value?.currentTrack ?? -1) !== -1
					: showingCaptionIdx() >= 0;
			},
			getCaptionsTracks(): string[] {
				const langs: string[] = [];
				const entries = captionEntries();
				for (const e of entries) {
					langs.push(e.track.language || "");
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
				} else if (dash) {
					let idx = findTrackIdx(track);
					if (idx < 0) {
						idx = firstCaptionTrackIdx();
					}
					dash.setTextTrack(idx >= 0 ? idx : -1);
					if (idx >= 0) {
						safeToggleCaptions(true, idx);
					}
				} else {
					if (hasValidPlyrTracks()) {
						player.value.currentTrack = findTrackIdx(track);
					} else {
						// Native Fallback: gewünschte Spur zeigen, alle anderen verstecken
						const idx = findTrackIdx(track);
						for (const e of captionEntries()) {
							e.track.mode = e.idx === idx ? "showing" : "hidden";
						}
					}
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

		let tracksList: TextTrackList | null = null;
		const onTracksChange: EventListener = () => {
			forcePlyrOverlay();
		};

		onMounted(() => {
			videoElem.value = document.getElementById("directplayer") as HTMLVideoElement;
			player.value = new Plyr(videoElem.value, {
				controls: [],
				clickToPlay: false,
				captions: {
					active: true,
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

			player.value.on("ready", () => applyControlsOffset(true));
			player.value.on("controlsshown", () => applyControlsOffset(true));
			player.value.on("controlshidden", () => applyControlsOffset(false));

			player.value.on("ready", () => emit("ready"));
			player.value.on("ended", () => emit("end"));
			player.value.on("playing", () => emit("playing"));
			player.value.on("pause", () => emit("paused"));
			player.value.on("play", () => emit("waiting"));
			player.value.on("stalled", () => emit("buffering"));
			player.value.on("loadstart", () => emit("buffering"));
			player.value.on("canplay", () => {
				emit("ready");
				forcePlyrOverlay();
				setTimeout(
					() =>
						applyControlsOffset(
							!(getContainer()?.classList.contains("plyr--hide-controls") ?? false)
						),
					0
				);
				captions.captionsTracks.value = playerImpl.getCaptionsTracks();
				captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
			});
			try {
				tracksList = videoElem.value?.textTracks ?? null;
				tracksList?.addEventListener("addtrack", onTracksChange, { passive: true });
				tracksList?.addEventListener("change", onTracksChange, { passive: true });
			} catch (e) {
				console.warn("PlyrPlayer: textTracks event binding skipped:", e);
			}
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

		function updateControlsHeightVar() {
			const controls = getControls();
			const host = getContainer() ?? videoElem.value?.parentElement ?? undefined;
			if (!controls || !host) return;
			const h = Math.ceil(controls.getBoundingClientRect().height || 0);
			const pad = 12; // small safety margin for shadows/hover area
			host.style.setProperty("--plyr-controls-height", `${h + pad}px`);
		}

		let classObserver: MutationObserver | null = null;
		let captionObserver: MutationObserver | null = null;

		function startClassObserver() {
			const container = getContainer();
			if (!container) return;
			classObserver?.disconnect();
			classObserver = new MutationObserver(() => {
				const hidden = container.classList.contains("plyr--hide-controls");
				applyControlsOffset(!hidden);
			});
			classObserver.observe(container, { attributes: true, attributeFilter: ["class"] });
			const hidden = container.classList.contains("plyr--hide-controls");
			applyControlsOffset(!hidden);
		}

		function startCaptionObserver() {
			const container = getContainer();
			if (!container) return;
			captionObserver?.disconnect();
			captionObserver = new MutationObserver(() => {
				const hidden = container.classList.contains("plyr--hide-controls");
				applyControlsOffset(!hidden);
			});
			captionObserver.observe(container, {
				subtree: true,
				childList: true,
			});
			const hidden = container.classList.contains("plyr--hide-controls");
			applyControlsOffset(!hidden);
		}

		function bindHoverFallback() {
			hoverContainer = getContainer();
			if (!hoverContainer) return;
			hoverContainer.addEventListener("mouseenter", onEnter, { passive: true });
			hoverContainer.addEventListener("mouseleave", onLeave, { passive: true });
		}
		function onEnter() {
			applyControlsOffset(true);
		}
		function onLeave() {
			applyControlsOffset(false);
		}

		function unbindHoverFallback() {
			if (!hoverContainer) return;
			hoverContainer.removeEventListener("mouseenter", onEnter);
			hoverContainer.removeEventListener("mouseleave", onLeave);
			hoverContainer = undefined;
		}

		function stopClassObserver() {
			classObserver?.disconnect();
			classObserver = null;
		}

		function stopCaptionObserver() {
			captionObserver?.disconnect();
			captionObserver = null;
		}

		let rafId: number | null = null;
		function updateControlsHeightVarRaf() {
			if (rafId != null) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				updateControlsHeightVar();
			});
		}

		onMounted(() => {
			startClassObserver();
			startCaptionObserver();
			bindHoverFallback();

			window.addEventListener("resize", updateControlsHeightVar);
			updateControlsHeightVar();
			const hidden = getContainer()?.classList.contains("plyr--hide-controls") ?? false;
			applyControlsOffset(!hidden);
			const host = getContainer() ?? videoElem.value?.parentElement;
			host?.addEventListener?.("mousemove", updateControlsHeightVarRaf);
		});

		onBeforeUnmount(() => {
			try {
				tracksList?.removeEventListener("addtrack", onTracksChange);
				tracksList?.removeEventListener("change", onTracksChange);
			} catch (e) {
				console.warn("PlyrPlayer: textTracks event unbinding skipped:", e);
			}
			stopClassObserver();
			stopCaptionObserver();
			unbindHoverFallback();
			const host = getContainer() ?? videoElem.value?.parentElement;
			host?.removeEventListener?.("mousemove", updateControlsHeightVarRaf);
			window.removeEventListener("resize", updateControlsHeightVar);

			if (rafId != null) cancelAnimationFrame(rafId);

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
					forcePlyrOverlay();
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

				const handleTextTracksAvailable = () => {
					forcePlyrOverlay();
					syncCaptions();
					if (!captions.isCaptionsEnabled.value || !hasCaptionTracks()) {
						return;
					}
					const idx = pickCaptionIdx();
					if (idx >= 0) {
						dash?.setTextTrack(idx);
						safeToggleCaptions(true, idx);
					}
				};

				// Fired when MPD is ready; text tracks may come slightly later, so also listen for TEXT_TRACK(S)_ADDED.
				dash.on("manifestLoaded", () => {
					console.info("PlyrPlayer: dash.js manifest loaded");
					emit("ready");
					forcePlyrOverlay();
					syncCaptions();
					const hidden =
						getContainer()?.classList.contains("plyr--hide-controls") ?? false;
					applyControlsOffset(!hidden);
				});

				dash.on(D.TEXT_TRACKS_ADDED ?? "allTextTracksAdded", handleTextTracksAvailable);

				dash.on(D.TEXT_TRACK_ADDED ?? "textTrackAdded", handleTextTracksAvailable);

				dash.on("streamInitialized", () => {
					console.info("PlyrPlayer: dash.js stream initialized");
					forcePlyrOverlay();
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
					const hidden =
						getContainer()?.classList.contains("plyr--hide-controls") ?? false;
					applyControlsOffset(!hidden);
				});
				dash.on("error", (event: unknown) => {
					console.error("PlyrPlayer: dash.js error:", event);
					emit("error");
				});
				dash.on("playbackError", (event: unknown) => {
					console.error("PlyrPlayer: dash.js playback error:", event);
					emit("error");
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
	position: relative;
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
	position: absolute;
	left: 0;
	right: 0;
	padding: 0 3%;
	pointer-events: none;
	transition: bottom 120ms ease-out;
	bottom: calc(16px + env(safe-area-inset-bottom));
	transform: none !important; // jegliches translateY von Plyr pauschal neutralisieren
	will-change: bottom;
}

// Firefox/Plyr: verschiebt Captions via translateY, das neutralisieren wir hart
.plyr:not(.plyr--hide-controls) .plyr__controls:not(:empty) ~ .plyr__captions {
	transform: none !important;
}

//Hold captions within the player bounds
.plyr,
.direct {
	overflow: hidden;
}

/* Plyr-rendered captions (non-native) */
.plyr__captions .plyr__caption {
	max-width: 92%;
	display: inline;
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
	font-size: clamp(14px, 2.2vw, 22px);
	line-height: 1.35;
	text-shadow: 0 1px 1px rgba(0, 0, 0, 0.7), 0 0 2px rgba(0, 0, 0, 0.7);
	background: rgba(0, 0, 0, 0.35);
	color: #fff;
}

/* Native captions fallback (e.g. iOS Safari). Only a subset of CSS is allowed. */
.direct video::cue {
	color: #fff;
	background-color: rgba(0, 0, 0, 0.35);
	font-size: clamp(14px, 2.2vw, 22px);
	line-height: 1.35;
	text-shadow: 0 1px 1px rgba(0, 0, 0, 0.7), 0 0 2px rgba(0, 0, 0, 0.7);
}
</style>
