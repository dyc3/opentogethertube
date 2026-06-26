<template>
	<div class="direct">
		<video
			ref="videoElem"
			preload="auto"
			crossorigin="anonymous"
			@canplay="onCanPlay"
			@playing="onPlaying"
			@pause="onPaused"
			@play="onWaiting"
			@waiting="onWaiting"
			@stalled="onBuffering"
			@loadstart="onBuffering"
			@progress="onProgress"
			@ended="onEnd"
			@error="onError"
		>
			<track
				v-for="track in vttTracks"
				:key="track.url"
				kind="subtitles"
				:src="track.url"
				:srclang="track.srclang"
				:label="track.name"
			/>
		</video>
		<div ref="assContainer" class="ass-container"></div>
	</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, toRefs, watch } from "vue";
import type { CaptionTrack, VideoTrack } from "@/models/media-tracks";
import type {
	CustomMediaManifest,
	CustomMediaTextTrack,
} from "ott-common/models/zod-schemas.js";
import type {
	MediaPlayerWithAudioBoost,
	MediaPlayerWithCaptions,
	MediaPlayerWithPlaybackRate,
	MediaPlayerWithQuality,
} from "../composables";
import { useAssOverlay, useCaptions, useMediaAudioBoost, useQualities } from "../composables";

interface Props {
	service: string;
	videoUrl: string;
	videoMime: string;
	thumbnail?: string;
	/**
	 * URL of the subtitle track to select by default for all viewers. For manifest
	 * items it must be one of the manifest's text tracks; for other items it is the
	 * URL of an external subtitle file. `null`/`undefined` means no subtitles are
	 * shown by default.
	 */
	defaultTrack?: string | null;
}

const props = defineProps<Props>();
const { videoUrl, videoMime, thumbnail, defaultTrack } = toRefs(props);
const videoElem = ref<HTMLVideoElement | undefined>();
const captions = useCaptions();
const audioBoost = useMediaAudioBoost(videoElem);
const qualities = useQualities();
const manifest = ref<CustomMediaManifest | null>(null);
const assContainer = ref<HTMLDivElement | undefined>();

/**
 * Infer the subtitle format of an external (non-manifest) track from its URL so
 * external `.vtt`/`.ass` files go through the same rendering paths as the tracks
 * declared by a manifest.
 */
function inferSubtitleContentType(url: string): CustomMediaTextTrack["contentType"] {
	const path = url.split("?")[0].split("#")[0];
	const ext = path.split(".").pop()?.toLowerCase();
	return ext === "ass" || ext === "ssa" ? "text/x-ass" : "text/vtt";
}

/**
 * The available text tracks, unified across source types. Manifest items declare
 * their tracks; for other items the single `defaultTrack` external subtitle (if
 * any) is the only track.
 */
const textTracks = computed<CustomMediaTextTrack[]>(() => {
	if (videoMime.value === "application/json") {
		return manifest.value?.textTracks ?? [];
	}
	if (defaultTrack.value) {
		return [
			{
				url: defaultTrack.value,
				contentType: inferSubtitleContentType(defaultTrack.value),
				srclang: "und",
				default: true,
			},
		];
	}
	return [];
});
const vttTracks = computed(() =>
	textTracks.value.filter(track => track.contentType === "text/vtt")
);
const assOverlay = useAssOverlay(videoElem, assContainer);

const emit = defineEmits<{
	"apiready": [];
	"ready": [];
	"playing": [];
	"paused": [];
	"waiting": [];
	"buffering": [];
	"error": [];
	"end": [];
	"buffer-progress": [progress: number];
	"buffer-spans": [spans: TimeRanges];
}>();

function play() {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	return videoElem.value.play();
}

function pause() {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	videoElem.value.pause();
}

function setVolume(volume: number) {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	videoElem.value.volume = volume / 100;
}

function getPosition() {
	if (!videoElem.value) {
		console.error("player not ready");
		return 0;
	}
	return videoElem.value.currentTime;
}

function setPosition(position: number) {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	videoElem.value.currentTime = position;
}

function isCaptionsSupported(): boolean {
	return true;
}

function textTrack(idx: number) {
	return textTracks.value[idx];
}

/**
 * Maps a text track index to its index in the native videoElem.textTracks list,
 * which only contains the VTT tracks. Returns -1 for non-VTT tracks.
 */
function nativeTrackIndex(idx: number): number {
	const tracks = textTracks.value;
	if (tracks[idx]?.contentType !== "text/vtt") {
		return -1;
	}
	return tracks.slice(0, idx).filter(t => t.contentType === "text/vtt").length;
}

/**
 * Activate the ASS overlay for the given text track index, if it exists.
 */
function activateAssTrack(idx: number): Promise<void> {
	const track = textTrack(idx);
	if (!track) {
		return Promise.resolve();
	}
	return assOverlay.load(track.url);
}

function setCaptionsEnabled(enabled: boolean): void {
	if (!videoElem.value || captions.currentTrack.value === null) {
		return;
	}
	if (textTracks.value.length === 0) {
		return;
	}
	if (captions.currentTrack.value === -1) {
		if (enabled) {
			setCaptionsTrack(0);
		}
		return;
	}
	const track = textTrack(captions.currentTrack.value);
	if (!track) {
		console.warn("DirectPlayer: invalid captions track index:", captions.currentTrack.value);
		return;
	}
	if (track.contentType === "text/x-ass") {
		if (enabled) {
			activateAssTrack(captions.currentTrack.value);
		} else {
			assOverlay.hide();
		}
		return;
	}
	const nativeIdx = nativeTrackIndex(captions.currentTrack.value);
	videoElem.value.textTracks[nativeIdx].mode = enabled ? "showing" : "hidden";
}

function isCaptionsEnabled(): boolean {
	if (!videoElem.value) {
		return false;
	}
	if (assOverlay.visible.value) {
		return true;
	}
	return Array.from(videoElem.value.textTracks).find(t => t.mode === "showing") !== undefined;
}

function getCaptionsTracks(): CaptionTrack[] {
	if (!videoElem.value) {
		return [];
	}
	return textTracks.value.map(track => ({
		kind: "subtitles",
		label: track.name ?? undefined,
		srclang: track.srclang,
		default: track.default,
	}));
}

function setCaptionsTrack(track: number): void {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	console.log("DirectPlayer: setCaptionsTrack:", track);
	const selected = textTrack(track);
	if (!selected) {
		console.warn("DirectPlayer: invalid captions track index:", track);
		return;
	}
	const nativeIdx = nativeTrackIndex(track);
	for (let i = 0; i < videoElem.value.textTracks.length; i++) {
		videoElem.value.textTracks[i].mode = i === nativeIdx ? "showing" : "hidden";
	}
	if (selected.contentType === "text/x-ass") {
		activateAssTrack(track);
	} else {
		assOverlay.hide();
	}
	captions.currentTrack.value = track;
}

function isQualitySupported(): boolean {
	return manifest.value !== null && manifest.value.sources.length > 1;
}

function getVideoTracks(): VideoTrack[] {
	if (!manifest.value) {
		return [];
	}
	return manifest.value.sources.map(s => ({
		label: s.quality,
		width: 0,
		height: s.quality,
	}));
}

function setVideoTrack(idx: number): void {
	if (!manifest.value || !videoElem.value) {
		return;
	}
	const source = manifest.value.sources[idx];
	if (!source) {
		return;
	}
	const currentTime = videoElem.value.currentTime;
	const wasPlaying = !videoElem.value.paused;
	videoElem.value.src = source.url;
	videoElem.value.load();
	videoElem.value.currentTime = currentTime;
	if (wasPlaying) {
		videoElem.value.play().catch(e => {
			console.error("DirectPlayer: error resuming after quality switch:", e);
		});
	}
	qualities.currentVideoTrack.value = idx;
}

function isAutoQualitySupported(): boolean {
	return false;
}

function getCurrentActiveQuality(): number | null {
	if (!videoElem.value || !manifest.value) {
		return null;
	}
	return manifest.value.sources.findIndex(s => s.url === videoElem.value?.src) ?? -1;
}

function getAvailablePlaybackRates(): number[] {
	return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
}

function getPlaybackRate(): number {
	if (!videoElem.value) {
		console.error("player not ready");
		return 1;
	}
	return videoElem.value.playbackRate;
}

async function setPlaybackRate(rate: number): Promise<void> {
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	videoElem.value.playbackRate = rate;
}

function setAudioBoost(boost: number): void {
	audioBoost.setBoost(boost);
}

async function loadVideoSource() {
	console.log("DirectPlayer: loading video source:", videoUrl.value, videoMime.value);
	if (!videoElem.value) {
		console.error("player not ready");
		return;
	}
	// Fix for captions from previous video still showing after source change
	for (let i = 0; i < videoElem.value.textTracks.length; i++) {
		videoElem.value.textTracks[i].mode = "hidden";
	}
	assOverlay.destroy();
	audioBoost.resetFailedSetup();
	manifest.value = null;

	if (videoMime.value === "application/json") {
		try {
			const response = await fetch(videoUrl.value);
			if (!response.ok) {
				console.error("DirectPlayer: failed to fetch manifest:", response.status);
				emit("error");
				return;
			}
			manifest.value = (await response.json()) as CustomMediaManifest;
		} catch (e) {
			console.error("DirectPlayer: failed to fetch manifest:", e);
			emit("error");
			return;
		}
		const firstSource = manifest.value.sources[0];
		if (!firstSource) {
			console.error("DirectPlayer: manifest has no sources");
			emit("error");
			return;
		}
		videoElem.value.src = firstSource.url;

		qualities.videoTracks.value = getVideoTracks();
		qualities.currentVideoTrack.value = 0;
	} else {
		videoElem.value.src = videoUrl.value;

		qualities.videoTracks.value = [];
		qualities.currentVideoTrack.value = -1;
	}

	// The default subtitle track (set via the Edit Video dialog) selects which track
	// to show by default, the same way for manifest tracks and external subtitle
	// files. A URL selects that track; `null`/`undefined` means no subtitles. Newly
	// inserted <track> elements start "disabled", so we explicitly set the chosen
	// track's mode to "showing" below.
	captions.captionsTracks.value = getCaptionsTracks();
	let defaultTrackIdx = -1;
	if (defaultTrack.value) {
		defaultTrackIdx = textTracks.value.findIndex(t => t.url === defaultTrack.value);
	}
	captions.currentTrack.value = defaultTrackIdx;
	captions.isCaptionsEnabled.value = defaultTrackIdx !== -1;
	if (defaultTrackIdx !== -1) {
		if (textTrack(defaultTrackIdx)?.contentType === "text/x-ass") {
			// Fire-and-forget: the overlay builds itself once the video's
			// dimensions are known, so it must not block load()/play() below.
			activateAssTrack(defaultTrackIdx);
		} else {
			await nextTick();
			videoElem.value.textTracks[nativeTrackIndex(defaultTrackIdx)].mode = "showing";
		}
	}

	videoElem.value.poster = thumbnail.value ?? "";
	videoElem.value.load();
	// this is needed to get the player to keep playing after the previous video has ended
	videoElem.value.play();

	console.log("DirectPlayer: current subtitle track:", captions.currentTrack.value);
	console.log("DirectPlayer: current video track:", qualities.currentVideoTrack.value);

	emit("apiready");
}

function onCanPlay() {
	emit("ready");
}

function onPlaying() {
	emit("playing");
}

function onPaused() {
	emit("paused");
}

function onWaiting() {
	emit("waiting");
}

function onBuffering() {
	emit("buffering");
}

function onProgress() {
	if (videoElem.value) {
		const buffered = videoElem.value.buffered;
		emit("buffer-spans", buffered);
		const duration = videoElem.value.duration;
		let bufferedTotal = 0;
		for (let i = 0; i < buffered.length; i++) {
			bufferedTotal += buffered.end(i) - buffered.start(i);
		}
		const bufferedPercentage = duration > 0 ? bufferedTotal / duration : 0;
		emit("buffer-progress", bufferedPercentage);
	}
}

function onEnd() {
	emit("end");
}

function onError(err: Event) {
	emit("error");
	console.error("DirectPlayer: error:", err);
}

onMounted(() => {
	loadVideoSource();
});

watch([videoUrl, defaultTrack], () => {
	console.log("DirectPlayer: videoUrl or defaultTrack changed");
	loadVideoSource();
});

defineExpose({
	play,
	pause,
	setVolume,
	getPosition,
	setPosition,
	isCaptionsSupported,
	setCaptionsEnabled,
	isCaptionsEnabled,
	getCaptionsTracks,
	setCaptionsTrack,
	isQualitySupported,
	getVideoTracks,
	setVideoTrack,
	isAutoQualitySupported,
	getCurrentActiveQuality,
	getAvailablePlaybackRates,
	getPlaybackRate,
	setPlaybackRate,
	setAudioBoost,
} satisfies MediaPlayerWithCaptions & MediaPlayerWithPlaybackRate & MediaPlayerWithAudioBoost & MediaPlayerWithQuality);
</script>

<!-- biome-ignore lint/nursery/useScopedStyles: biome migration -->
<style lang="scss">
.direct {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
	position: relative;
}

.direct .ass-container {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 1;
	overflow: hidden;
}

.direct video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: 50% 50%;
}
</style>
