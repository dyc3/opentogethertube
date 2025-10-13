<template>
	<div class="hls">
		<video
			id="hlsplayer"
			preload="auto"
			crossorigin="anonymous"
			:poster="thumbnail || ''"
			@canplay="onReady"
			@ready="onReady"
			@playing="onPlaying"
			@pause="onPaused"
			@stalled="onBuffering"
			@loadstart="onBuffering"
			@progress="onProgress"
			@ended="onEnd"
			@error="onError"
		></video>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import Hls from "hls.js";
import type {
	MediaPlayerWithCaptions,
	MediaPlayerWithPlaybackRate,
	MediaPlayerWithQuality,
} from "../composables";
import { useCaptions, useQualities } from "../composables";
import type { VideoTrack, CaptionTrack } from "@/models/media-tracks";

interface Props {
	videoUrl: string;
	thumbnail?: string;
}

const props = defineProps<Props>();
const { videoUrl, thumbnail } = toRefs(props);
const videoElem = ref<HTMLVideoElement | undefined>();
const captions = useCaptions();
const qualities = useQualities();
let hls: Hls | undefined = undefined;

const emit = defineEmits<{
	"apiready": [];
	"ready": [];
	"playing": [];
	"paused": [];
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

function setCaptionsEnabled(enabled: boolean): void {
	if (!hls) {
		return;
	}
	if (enabled) {
		hls.subtitleTrack = captions.currentTrack.value || 0;
	} else {
		hls.subtitleTrack = -1;
	}
}

function isCaptionsEnabled(): boolean {
	if (!hls) {
		return false;
	}
	return hls.subtitleTrack !== -1;
}

function getCaptionsTracks(): CaptionTrack[] {
	console.log("HlsPlayer: getCaptionsTracks:", hls?.subtitleTracks);
	if (!hls) {
		console.error("player not ready");
		return [];
	}
	if (!hls.subtitleTracks || hls.subtitleTracks.length === 0) {
		console.log("HlsPlayer: no captions tracks available");
		return [];
	}
	const tracks: CaptionTrack[] = hls.subtitleTracks.map(track => ({
		// hls.js should return either `SUBTITLES` or `CLOSED-CAPTIONS`
		kind: track.type === "SUBTITLES" ? "subtitles" : "captions",
		label: track.name || undefined,
		srclang: track.lang || undefined,
		default: track.default,
	}));
	return tracks;
}

function setCaptionsTrack(track: number): void {
	if (!hls) {
		console.error("HlsPlayer: player not ready");
		return;
	}
	console.log("HlsPlayer: setCaptionsTrack:", track);
	hls.subtitleTrack = track;
}

function isQualitySupported(): boolean {
	return true;
}

function getVideoTracks(): VideoTrack[] {
	if (!hls || !hls.levels) {
		console.error("player not ready");
		return [];
	}
	console.log("HlsPlayer: getVideoTracks:", hls.levels);
	if (hls.levels.length === 1) {
		console.log("HlsPlayer: no other video tracks available");
		if (hls.levels[0].height === 0) {
			// if the only level height is 0, then don't return any quality levels
			return [];
		}
	}
	return hls.levels.map(level => ({ width: level.width, height: level.height }));
}

function setVideoTrack(track: number): void {
	if (!hls) {
		console.error("player not ready");
		return;
	}
	if (track >= hls.levels.length || track < -1) {
		console.error("HlsPlayer:  HLS.js video track not found:", track);
		return;
	}

	const isAutoEnabled = hls.autoLevelEnabled;
	const currentTrack = isAutoEnabled ? -1 : hls.currentLevel;
	if (track === currentTrack) {
		return;
	}

	// hls.currentLevel immediately switches to the specified quality level.
	// hls.loadLevel switches to the new quality level
	// hls.nextLevel switches to the new quality level and eventually flush already buffered next fragments.
	// To smoothly switch quality levels, let's use nextLevel.
	hls.nextLevel = track;
	console.log("HlsPlayer: setting HLS.js video track:", track);
}

function isAutoQualitySupported(): boolean {
	return true;
}

function getCurrentActiveQuality(): number | null {
	if (!hls || !hls.levels || hls.levels.length === 0) {
		return null;
	}
	return hls.currentLevel;
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

function loadVideoSource() {
	console.log("HlsPlayer: loading video source:", videoUrl.value);

	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}

	hls?.destroy();
	hls = undefined;

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

		captions.captionsTracks.value = getCaptionsTracks();
		captions.isCaptionsEnabled.value = isCaptionsEnabled();
		captions.currentTrack.value = hls?.subtitleTrack || 0;
		console.log("HlsPlayer: current subtitle track:", hls?.subtitleTrack);

		qualities.videoTracks.value = getVideoTracks();
		qualities.currentVideoTrack.value = hls?.autoLevelEnabled ? -1 : hls?.currentLevel || -1;
		qualities.currentActiveQuality.value = getCurrentActiveQuality();
		console.log("HlsPlayer: current video track:", qualities.currentVideoTrack.value);
	});

	hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
		console.info("HlsPlayer: hls.js level switched:", data);
		qualities.currentActiveQuality.value = getCurrentActiveQuality();
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

onMounted(() => {
	videoElem.value = document.getElementById("hlsplayer") as HTMLVideoElement;
	if (!videoElem.value) {
		console.error("HLS player video element not found");
		return;
	}
	loadVideoSource();
});

function onReady() {
	emit("ready");
}
function onPlaying() {
	emit("playing");
}
function onPaused() {
	emit("paused");
}
function onBuffering() {
	emit("buffering");
}
function onProgress() {
	if (videoElem.value) {
		const buffered = videoElem.value.buffered;
		emit("buffer-spans", buffered);
		const duration = videoElem.value.duration;
		const bufferedPercentage =
			buffered && buffered.length && duration > 0 ? buffered.end(0) / duration : 0;
		emit("buffer-progress", bufferedPercentage);
	}
}
function onEnd() {
	emit("end");
}
function onError(err: Event) {
	emit("error");
	console.error("HlsPlayer: video element error:", err);
}

onBeforeUnmount(() => {
	hls?.destroy();
});

watch(videoUrl, () => {
	console.log("HlsPlayer: videoUrl changed");
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
} satisfies MediaPlayerWithCaptions & MediaPlayerWithQuality & MediaPlayerWithPlaybackRate);
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
