<template>
	<div class="dash">
		<video
			id="dashplayer"
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
			@error="onError"
		></video>
	</div>
	<div id="dashplayer-ttml-rendering"></div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import * as dashjs from "dashjs";
import type { MediaPlayerWithCaptions, MediaPlayerWithPlaybackRate } from "../composables";
import { useCaptions } from "../composables";

interface Props {
	videoUrl: string;
	thumbnail?: string;
}

const props = defineProps<Props>();
const { videoUrl, thumbnail } = toRefs(props);
const videoElem = ref<HTMLVideoElement>();
const ttlmCaption = ref<HTMLDivElement>();
const captions = useCaptions();
const dash = ref<dashjs.MediaPlayerClass | undefined>(undefined);

const emit = defineEmits([
	"apiready",
	"ready",
	"playing",
	"paused",
	"buffering",
	"error",
	"buffer-progress",
	"buffer-spans",
]);

function play() {
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	return videoElem.value.play();
}

function pause() {
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	videoElem.value.pause();
}

function setVolume(volume: number) {
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	videoElem.value.volume = volume / 100;
}

function getPosition() {
	if (!videoElem.value) {
		console.error("video element not ready");
		return 0;
	}
	return videoElem.value.currentTime;
}

function setPosition(position: number) {
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	videoElem.value.currentTime = position;
}

function isCaptionsSupported(): boolean {
	return true;
}

function setCaptionsEnabled(enabled: boolean): void {
	if (!dash.value) {
		return;
	}
	if (enabled) {
		setCaptionsTrack(captions.currentTrack.value || "");
	} else {
		dash.value.setTextTrack(-1);
	}
}

function isCaptionsEnabled(): boolean {
	if (!dash.value) {
		return false;
	}
	return dash.value.getCurrentTextTrackIndex() !== -1;
}

function getCaptionsTracks(): string[] {
	if (!dash.value) {
		return [];
	}
	const captionsTracks = dash.value.getTracksFor("text").map(track => {
		const label = track.labels["text"] || track.labels["lang"] || track.lang || "unknown";
		if (track.roles && track.roles.length > 0 && track.roles[0]["value"]) {
			return `${label} (${track.roles[0]["value"]})`;
		}
		return label;
	});
	console.log("DashPlayer: available captions tracks:", captionsTracks);
	return captionsTracks;
}

function setCaptionsTrack(track: string): void {
	if (!dash.value) {
		console.error("dash.js player not ready");
		return;
	}
	const trackIdx = captions.captionsTracks.value.findIndex(t => t === track);
	if (trackIdx === -1) {
		console.error("DashPlayer: captions track not found:", track);
		return;
	}
	console.log("DashPlayer: setting captions track to", track, "at index", trackIdx);
	dash.value.setTextTrack(trackIdx);
}

function isQualitySupported(): boolean {
	return false;
}

function getAvailablePlaybackRates(): number[] {
	return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
}

function getPlaybackRate(): number {
	if (!videoElem.value) {
		console.error("video element not ready");
		return 1;
	}
	return videoElem.value.playbackRate;
}

async function setPlaybackRate(rate: number): Promise<void> {
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	videoElem.value.playbackRate = rate;
}

function loadVideoSource() {
	console.log("DashPlayer: loading video source:", props.videoUrl);
	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}

	dash.value?.destroy();
	dash.value = undefined;

	dash.value = dashjs.MediaPlayer().create();
	dash.value.initialize(videoElem.value, props.videoUrl, false);
	if (ttlmCaption.value) {
		dash.value.attachTTMLRenderingDiv(ttlmCaption.value);
	}

	dash.value.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
		console.info("DashPlayer: dash.js manifest loaded");
		emit("ready");
	});
	dash.value.on(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, () => {
		captions.captionsTracks.value = getCaptionsTracks();
		captions.isCaptionsEnabled.value = isCaptionsEnabled();
		if (dash.value?.getCurrentTextTrackIndex() !== -1) {
			captions.currentTrack.value =
				captions.captionsTracks.value[dash.value?.getCurrentTextTrackIndex() || 0];
		} else {
			captions.currentTrack.value = "";
			console.log("DashPlayer: no text track selected");
		}
	});
	dash.value.on(dashjs.MediaPlayer.events.ERROR, (event: unknown) => {
		console.error("DashPlayer: dash.js error:", event);
		emit("error");
	});
	dash.value.on(dashjs.MediaPlayer.events.PLAYBACK_ERROR, (event: unknown) => {
		console.error("DashPlayer: dash.js playback error:", event);
		emit("error");
	});
	dash.value.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
		console.info("DashPlayer: dash.js stream initialized");
	});
	dash.value.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, () => {
		console.info("DashPlayer: dash.js buffer stalled");
		emit("buffering");
	});
	dash.value.on(dashjs.MediaPlayer.events.BUFFER_LOADED, () => {
		console.info("DashPlayer: dash.js buffer loaded");
		emit("ready");
	});

	// this is needed to get the player to keep playing after the previous video has ended
	videoElem.value.play();

	emit("apiready");
}

onMounted(() => {
	videoElem.value = document.getElementById("dashplayer") as HTMLVideoElement;
	ttlmCaption.value = document.getElementById("dashplayer-ttml-rendering") as HTMLDivElement;

	if (!videoElem.value) {
		console.error("Dash player video element not found");
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
function onError(err: Event) {
	emit("error");
	console.error("HlsPlayer: video element error:", err);
}

onBeforeUnmount(() => {
	dash.value?.destroy();
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
	getAvailablePlaybackRates,
	getPlaybackRate,
	setPlaybackRate,
} satisfies MediaPlayerWithCaptions & MediaPlayerWithPlaybackRate);
</script>

<style lang="scss">
.dash {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
}

.dash video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: 50% 50%;
}
</style>
