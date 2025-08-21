<template>
	<div class="direct">
		<video id="directplayer" preload="auto"></video>
	</div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
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
				return ["direct", "hls"].includes(props.service);
			},
			setCaptionsEnabled(enabled: boolean): void {
				if (hls) {
					hls.subtitleDisplay = enabled;
				} else {
					player.value?.toggleCaptions(enabled);
				}
			},
			isCaptionsEnabled(): boolean {
				if (hls) {
					return hls.subtitleDisplay;
				} else {
					return player.value?.currentTrack !== -1;
				}
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
				if (hls) {
					hls.subtitleTrack = findTrackIdx(track);
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
				hls = new Hls({
					capLevelToPlayerSize: false,
					abrEwmaDefaultEstimate: 8_000_000, // ~8Mbps
					startLevel: -1, // auto
				});

				hls.loadSource(videoUrl.value);
				hls.attachMedia(videoElem.value);
				// Helper
				const logCurrentHlsLevel = (label: string) => {
					try {
						if (!hls) return;
						const idx =
							(hls.currentLevel ?? -1) >= 0
								? hls.currentLevel
								: hls.nextLevel ?? hls.loadLevel ?? -1;
						const lvl = idx >= 0 ? hls.levels[idx] : undefined;
						console.info(`[hls.js] current level (${label})`, {
							index: idx,
							bitrateKbps: lvl?.bitrate ? Math.round(lvl.bitrate / 1000) : undefined,
							width: lvl?.width,
							height: lvl?.height,
							name: (lvl as any)?.name,
							auto: hls.autoLevelEnabled,
							cappedToPlayerSize: hls.config?.capLevelToPlayerSize,
						});
					} catch {}
				};

				hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data: any) => {
					const h = hls;
					if (!h) return; // TS: narrow Hls | undefined -> Hls
					console.info("PlyrPlayer: hls.js manifest parsed");
					try {
						const levels = (data?.levels ?? h.levels ?? []).map(
							(l: any, i: number) => ({
								index: i,
								bitrateKbps: l?.bitrate ? Math.round(l.bitrate / 1000) : undefined,
								width: l?.width,
								height: l?.height,
								name: l?.name,
							})
						);
						console.info("[hls.js] manifest levels", levels);
						const max = (h.levels?.length || 0) - 1;
						if (max >= 0) {
							h.currentLevel = max;
							h.nextLevel = max;
							console.info("[hls.js] forced highest level", levels[max]);
						}
					} catch {}
					logCurrentHlsLevel("after MANIFEST_PARSED");
					emit("ready");
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				hls.on(Hls.Events.ERROR, (event, data) => {
					console.error("PlyrPlayer: hls.js error:", event, data);
					console.error("PlyrPlayer: hls.js inner error:", data.error);
					emit("error");
				});
				hls.on(Hls.Events.LEVEL_SWITCHING, (_evt, data: any) => {
					const cand = hls?.levels?.[data?.level];
					console.info("[hls.js] level requested →", {
						index: data?.level,
						bitrateKbps: cand?.bitrate ? Math.round(cand.bitrate / 1000) : undefined,
						width: cand?.width,
						height: cand?.height,
						name: (cand as any)?.name,
					});
				});
				hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data: any) => {
					const cur = hls?.levels?.[data?.level];
					console.info("[hls.js] level rendered ✔", {
						index: data?.level,
						bitrateKbps: cur?.bitrate ? Math.round(cur.bitrate / 1000) : undefined,
						width: cur?.width,
						height: cur?.height,
						name: (cur as any)?.name,
					});
					logCurrentHlsLevel("after LEVEL_SWITCHED");
				});
				videoElem.value.addEventListener("playing", () => {
					logCurrentHlsLevel("HTML5 playing");
				});
				videoElem.value.addEventListener("seeked", () => {
					try {
						const max = (hls?.levels?.length || 0) - 1;
						if (max >= 0 && hls) {
							hls.nextLevel = max;
							hls.currentLevel = max;
						}
					} catch {}
					logCurrentHlsLevel("after seeked (forced MAX)");
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
				videoElem.value = document.querySelector("video") as HTMLVideoElement;
				// ...so that we can use dash.js to change the video source
				// Add EventLister for "Seeking(Seeked)"
				videoElem.value.addEventListener("seeked", () => {
					try {
						const list = dash?.getBitrateInfoListFor("video") || [];
						const maxIndex = list.length ? list.length - 1 : 0;
						dash?.setQualityFor("video", maxIndex);
					} catch {}
					logCurrentDashQuality("after seeked (forced MAX)");
				});
				// Allow fast switching
				dash.updateSettings({ streaming: { fastSwitchEnabled: true } } as any);

				const logCurrentDashQuality = (label: string) => {
					try {
						const q = dash?.getQualityFor("video");
						const list = dash?.getBitrateInfoListFor("video") || [];
						const it = q != null && list[q] ? list[q] : undefined;
						console.info(`[dash.js] current quality (${label})`, {
							index: q,
							bitrateKbps: it?.bitrate ? Math.round(it.bitrate / 1000) : undefined,
							width: it?.width,
							height: it?.height,
						});
					} catch {}
				};

				dash.initialize(videoElem.value, videoUrl.value, false);

				// Prefer official Eventhandling from dash.js
				dash.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
					console.info("PlyrPlayer: dash.js manifest loaded");
					// Try highest possible quality first
					try {
						const list = dash?.getBitrateInfoListFor("video") || [];
						const maxIndex = list.length ? list.length - 1 : 0;
						dash?.setQualityFor("video", maxIndex);
						console.info("[dash.js] forced highest quality", {
							index: maxIndex,
							bitrateKbps: list[maxIndex]?.bitrate
								? Math.round(list[maxIndex].bitrate / 1000)
								: undefined,
							width: list[maxIndex]?.width,
							height: list[maxIndex]?.height,
						});
					} catch {}
					logCurrentDashQuality("after MANIFEST_LOADED");
					emit("ready");
					captions.captionsTracks.value = playerImpl.getCaptionsTracks();
					captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
				});
				dash.on(dashjs.MediaPlayer.events.ERROR, (event: unknown) => {
					console.error("PlyrPlayer: dash.js error:", event);
					emit("error");
				});
				dash.on(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
					logCurrentDashQuality("PLAYBACK_PLAYING");
					console.info("PlyrPlayer: dash.js video Playing");
				});
				//*** Temporary loginfo for quality
				dash.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, (e: any) => {
					if (e?.mediaType !== "video") return;
					const list = dash?.getBitrateInfoListFor("video") || [];
					const cand = list[e.newQuality];
					console.info("[dash.js] quality requested →", {
						index: e.newQuality,
						bitrateKbps: cand?.bitrate ? Math.round(cand.bitrate / 1000) : undefined,
						width: cand?.width,
						height: cand?.height,
						reason: e?.reason,
					});
				});
				dash.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: any) => {
					if (e?.mediaType !== "video") return;
					const list = dash?.getBitrateInfoListFor("video") || [];
					const cand = list[e.newQuality];
					console.info("[dash.js] quality rendered ✔", {
						index: e.newQuality,
						bitrateKbps: cand?.bitrate ? Math.round(cand.bitrate / 1000) : undefined,
						width: cand?.width,
						height: cand?.height,
					});
					logCurrentDashQuality("after QUALITY_CHANGE_RENDERED");
				});
				// TEMP END ***
				dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
					console.info("PlyrPlayer: dash.js stream initialized");
				});
				dash.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, () => {
					console.info("PlyrPlayer: dash.js buffer stalled");
					emit("buffering");
				});
				dash.on(dashjs.MediaPlayer.events.BUFFER_LOADED, () => {
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
