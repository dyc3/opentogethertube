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
import { MediaPlayer, type MediaPlayerClass } from "dashjs";
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
const videoElem = ref<HTMLVideoElement>();
const ttlmCaption = ref<HTMLDivElement>();
const captions = useCaptions();
const qualities = useQualities();
const dash = ref<MediaPlayerClass | undefined>(undefined);

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
		dash.value.setTextTrack(captions.currentTrack.value || 0);
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

function getCaptionsTracks(): CaptionTrack[] {
	if (!dash.value) {
		return [];
	}
	const tracks: CaptionTrack[] = dash.value.getTracksFor("text").map(track => {
		const kind =
			!track.roles || track.roles.length === 0 || !track.roles[0]["value"]
				? undefined
				: ["subtitle", "subtitles"].includes(track.roles[0]["value"])
				? "subtitles"
				: ["caption", "captions"].includes(track.roles[0]["value"])
				? "captions"
				: undefined;
		return {
			kind: kind,
			label: track.labels["text"] || undefined,
			srclang: track.labels["lang"] || track.lang || undefined,
			default: false, // dash.js does not provide info about default track
		};
	});
	console.log("DashPlayer: available captions tracks:", tracks);
	return tracks;
}

function setCaptionsTrack(track: number): void {
	if (!dash.value) {
		console.error("dash.js player not ready");
		return;
	}
	console.log("DashPlayer: setting captions track to", track, "at index", track);
	dash.value.setTextTrack(track);
}

function isQualitySupported(): boolean {
	return true;
}

function getVideoTracks(): VideoTrack[] {
	if (!dash.value) {
		console.error("player not ready");
		return [];
	}
	const videoTracks = dash.value
		.getRepresentationsByType("video")
		.map(rep => ({ width: rep.width, height: rep.height }));
	console.log("DashPlayer: getVideoTracks:", videoTracks);
	if (videoTracks.length === 1) {
		console.log("DashPlayer: no other video tracks available");
		if (videoTracks[0].height === 0) {
			// if the only level height is 0, then don't return any quality levels
			return [];
		}
	}
	return videoTracks;
}

function setVideoTrack(track: number): void {
	if (!dash.value) {
		console.error("dash.js player not ready");
		return;
	}
	if (track >= getVideoTracks().length || track < -1) {
		console.error("DashPlayer: video track not found:", track);
		return;
	}

	const isAutoEnabled =
		dash.value.getSettings().streaming?.abr?.autoSwitchBitrate?.video || false;
	const currentRepresentation = dash.value.getCurrentRepresentationForType("video");
	const currentTrack = isAutoEnabled ? -1 : currentRepresentation?.index || 0;
	// Return early if the requested track is already active
	if (track === currentTrack) {
		return;
	}

	// setRepresentationForTypeByIndex could be overridden by ABR if autoSwitchBitrate is enabled
	const enableAutoSwitch = track === -1;
	dash.value.updateSettings({
		streaming: {
			abr: {
				autoSwitchBitrate: { audio: true, video: enableAutoSwitch },
			},
		},
	});
	if (enableAutoSwitch) {
		console.log("DashPlayer: setting video track to auto");
		return;
	}

	// With forceReplace set to true, the buffer is aggressively cleared, ensuring instant quality switching.
	// This can also cause rebuffering, but since we are watching "together", we set this to false to avoid playback interruptions.
	// With the help of `fastSwitchEnabled`, the quality up-switch should happen when the buffer is healthy enough.
	const forceSwitch = false;
	dash.value.setRepresentationForTypeByIndex("video", track, forceSwitch);
	console.log("DashPlayer: setting video track to index", track);
}

function isAutoQualitySupported(): boolean {
	return true;
}

function getCurrentActiveQuality(): number {
	if (!dash.value) {
		console.error("dash.js player not ready");
		return -1;
	}
	const representation = dash.value.getCurrentRepresentationForType("video");
	console.log("DashPlayer: current active quality:", representation);
	return representation?.index || 0;
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

	dash.value = MediaPlayer().create();
	dash.value.initialize(videoElem.value, props.videoUrl, false);
	if (ttlmCaption.value) {
		dash.value.attachTTMLRenderingDiv(ttlmCaption.value);
	}

	// When fastSwitchEnabled is set to true the next fragment is requested and appended
	// close to the current playback time.
	// Note: When ABR down-switch is detected, dash.js appends the lower quality
	// at the end of the buffer range to preserve the higher quality media for as long as possible.
	dash.value.updateSettings({
		streaming: {
			buffer: {
				fastSwitchEnabled: true,
			},
		},
	});

	dash.value.on(MediaPlayer.events.MANIFEST_LOADED, () => {
		console.info("DashPlayer: dash.js manifest loaded");
		emit("ready");
	});
	dash.value.on(MediaPlayer.events.TEXT_TRACKS_ADDED, () => {
		captions.captionsTracks.value = getCaptionsTracks();
		captions.isCaptionsEnabled.value = isCaptionsEnabled();
		if (dash.value?.getCurrentTextTrackIndex() !== -1) {
			captions.currentTrack.value = dash.value?.getCurrentTextTrackIndex() || 0;
		} else {
			captions.currentTrack.value = null;
			console.log("DashPlayer: no text track selected");
		}
	});
	dash.value.on(MediaPlayer.events.ERROR, (event: unknown) => {
		console.error("DashPlayer: dash.js error:", event);
		emit("error");
	});
	dash.value.on(MediaPlayer.events.PLAYBACK_ERROR, (event: unknown) => {
		console.error("DashPlayer: dash.js playback error:", event);
		emit("error");
	});
	dash.value.on(MediaPlayer.events.STREAM_INITIALIZED, () => {
		console.info("DashPlayer: dash.js stream initialized");
		qualities.videoTracks.value = getVideoTracks();
		const isAuto = dash.value?.getSettings()?.streaming?.abr?.autoSwitchBitrate?.video || false;
		const currentVideoTrack = dash.value?.getCurrentRepresentationForType("video")?.index || 0;
		qualities.currentVideoTrack.value = isAuto ? -1 : currentVideoTrack;
		console.log("DashPlayer: current video track:", qualities.currentVideoTrack.value);
		qualities.currentActiveQuality.value = getCurrentActiveQuality();
		console.log("DashPlayer: current active quality:", qualities.currentActiveQuality.value);
	});
	dash.value.on(MediaPlayer.events.BUFFER_EMPTY, () => {
		console.info("DashPlayer: dash.js buffer stalled");
		emit("buffering");
	});
	dash.value.on(MediaPlayer.events.BUFFER_LOADED, () => {
		console.info("DashPlayer: dash.js buffer loaded");
		emit("ready");
	});
	dash.value.on(MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
		console.info("DashPlayer: dash.js quality change rendered");
		qualities.currentActiveQuality.value = getCurrentActiveQuality();
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
