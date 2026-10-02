<template>
	<div class="jellyfin">
		<video
			ref="videoElem"
			id="jellyfinplayer"
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
		></video>
	</div>
</template>

<script lang="ts" setup>
import Hls from "hls.js";
import { onBeforeUnmount, onMounted, ref, toRefs, watch } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "@/store";
import { API } from "@/common-http";
import type { AudioTrack, CaptionTrack, VideoTrack } from "@/models/media-tracks";
import type {
	MediaPlayerWithAudio,
	MediaPlayerWithAudioBoost,
	MediaPlayerWithCaptions,
	MediaPlayerWithPlaybackRate,
	MediaPlayerWithQuality,
} from "../composables";
import { useCaptions, useMediaAudioBoost } from "../composables";
import type { MediaPlayerError } from "../composables/media-player";
import type { OttResponseBody, OttApiResponseRefreshStream } from "ott-common/models/rest-api";

interface Props {
	videoUrl: string;
	videoId: string;
	thumbnail?: string;
	availableSubtitles?: Array<{ url: string; label?: string; language?: string }>;
	availableAudioTracks?: AudioTrack[];
}

const props = withDefaults(defineProps<Props>(), {
	availableSubtitles: () => [],
	availableAudioTracks: () => [],
});
const { videoUrl, thumbnail } = toRefs(props);
const videoElem = ref<HTMLVideoElement | undefined>();
const captions = useCaptions();
const audioBoost = useMediaAudioBoost(videoElem);
const currentUrl = ref(props.videoUrl);
const currentAudioTrackIndex = ref<number | null>(null);
let hls: Hls | undefined;
let currentRequestId = 0;

const route = useRoute();
const store = useStore();

const emit = defineEmits<{
	"apiready": [];
	"ready": [];
	"playing": [];
	"paused": [];
	"buffering": [];
	"error": [error: MediaPlayerError];
	"end": [];
	"buffer-progress": [progress: number];
	"buffer-spans": [spans: TimeRanges];
}>();

function play() {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: player not ready");
		return;
	}
	return videoElem.value.play();
}

function pause() {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: player not ready");
		return;
	}
	videoElem.value.pause();
}

function setVolume(volume: number) {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: player not ready");
		return;
	}
	videoElem.value.volume = volume / 100;
}

function getPosition() {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: player not ready");
		return 0;
	}
	return videoElem.value.currentTime;
}

function setPosition(position: number) {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: player not ready");
		return;
	}
	videoElem.value.currentTime = position;
}

function isCaptionsSupported(): boolean {
	return true;
}

function isCaptionsEnabled(): boolean {
	return captions.isCaptionsEnabled.value;
}

function setCaptionsEnabled(enabled: boolean): void {
	if (!videoElem.value) {
		return;
	}
	const tracks = videoElem.value.textTracks;
	for (let i = 0; i < tracks.length; i++) {
		tracks[i].mode = enabled && i === captions.currentTrack.value ? "showing" : "hidden";
	}
	captions.isCaptionsEnabled.value = enabled;
}

function getCaptionsTracks(): CaptionTrack[] {
	if (!videoElem.value) {
		return [];
	}
	const tracks = videoElem.value.textTracks;
	if (!tracks || tracks.length === 0) {
		return [];
	}
	const result: CaptionTrack[] = [];
	for (let i = 0; i < tracks.length; i++) {
		const t = tracks[i];
		result.push({
			kind: t.kind === "subtitles" ? "subtitles" : "captions",
			label: t.label || undefined,
			srclang: t.language || undefined,
			default: false,
		});
	}
	return result;
}

function setCaptionsTrack(track: number): void {
	if (!videoElem.value) {
		return;
	}
	const tracks = videoElem.value.textTracks;
	for (let i = 0; i < tracks.length; i++) {
		tracks[i].mode = i === track ? "showing" : "hidden";
	}
	captions.currentTrack.value = track;
}

function addExternalSubtitleTracks(): void {
	if (!videoElem.value) {
		return;
	}
	const existingTracks = videoElem.value.querySelectorAll("track");
	for (const track of existingTracks) {
		track.remove();
	}
	if (!props.availableSubtitles || props.availableSubtitles.length === 0) {
		return;
	}
	for (const sub of props.availableSubtitles) {
		const track = document.createElement("track");
		track.kind = "subtitles";
		track.label = sub.label ?? `Subtitle ${sub.language ?? "und"}`;
		track.srclang = sub.language ?? "und";
		track.src = sub.url;
		videoElem.value.appendChild(track);
	}
}

function isQualitySupported(): boolean {
	return true;
}

function getVideoTracks(): VideoTrack[] {
	if (!hls || !hls.levels) {
		return [];
	}
	if (hls.levels.length === 1 && hls.levels[0].height === 0) {
		return [];
	}
	return hls.levels.map(level => ({
		width: level.width,
		height: level.height,
	}));
}

function setVideoTrack(track: number): void {
	if (!hls) {
		console.error("JellyfinPlayer: player not ready");
		return;
	}
	if (track >= hls.levels.length || track < -1) {
		console.error("JellyfinPlayer: video track not found:", track);
		return;
	}

	const isAutoEnabled = hls.autoLevelEnabled;
	const currentTrack = isAutoEnabled ? -1 : hls.currentLevel;
	if (track === currentTrack) {
		return;
	}

	hls.nextLevel = track;
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
	return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
}

function getPlaybackRate(): number {
	if (!videoElem.value) {
		return 1;
	}
	return videoElem.value.playbackRate;
}

async function setPlaybackRate(rate: number): Promise<void> {
	if (!videoElem.value) {
		return;
	}
	videoElem.value.playbackRate = rate;
}

function setAudioBoost(boost: number): void {
	audioBoost.setBoost(boost);
}

function isAudioSupported(): boolean {
	return (props.availableAudioTracks ?? []).length > 0;
}

function getAudioTracks(): AudioTrack[] {
	return props.availableAudioTracks ?? [];
}

function getCurrentAudioTrack(): number | null {
	return currentAudioTrackIndex.value;
}

async function setAudioTrack(index: number): Promise<void> {
	if (index === currentAudioTrackIndex.value) {
		return;
	}
	if (!props.videoId) {
		console.warn("JellyfinPlayer: cannot refresh stream without videoId");
		return;
	}
	const roomName = (route.params.roomId ?? route.params.name ?? store.state.room.name) as string;
	if (!roomName) {
		console.warn("JellyfinPlayer: no room name found for refresh-stream");
		return;
	}

	const requestId = ++currentRequestId;
	const targetVideoId = props.videoId;
	const savedTime = getPosition();
	const wasPlaying = videoElem.value ? !videoElem.value.paused : false;

	try {
		const resp = await API.post<OttResponseBody<OttApiResponseRefreshStream>>(
			`/room/${roomName}/refresh-stream`,
			{
				service: "jellyfin",
				id: targetVideoId,
				audioStreamIndex: index,
			},
		);

		if (requestId !== currentRequestId || props.videoId !== targetVideoId) {
			return;
		}

		if (resp.data && resp.data.success && resp.data.hls_url) {
			currentUrl.value = resp.data.hls_url;
			currentAudioTrackIndex.value = index;

			if (videoElem.value) {
				loadVideoSource(savedTime, wasPlaying);
			}
		}
	} catch (e) {
		if (requestId === currentRequestId) {
			console.error("JellyfinPlayer: failed to refresh stream with audio track", index, e);
		}
	}
}

function initAudioTrack() {
	if (props.availableAudioTracks && props.availableAudioTracks.length > 0) {
		const defaultTrack = props.availableAudioTracks.find(t => t.isDefault);
		currentAudioTrackIndex.value = defaultTrack
			? defaultTrack.index
			: props.availableAudioTracks[0].index;
	} else {
		currentAudioTrackIndex.value = null;
	}
}

function loadVideoSource(restoreTime?: number, autoPlay?: boolean) {
	if (!videoElem.value) {
		console.error("JellyfinPlayer: video element not ready");
		return;
	}
	audioBoost.resetFailedSetup();

	if (hls) {
		hls.stopLoad();
		hls.detachMedia();
		hls.destroy();
		hls = undefined;
	}

	const savedCaptionEnabled = captions.isCaptionsEnabled.value;
	const savedCaptionTrack = captions.currentTrack.value;

	if (restoreTime === undefined) {
		captions.captionsTracks.value = [];
		captions.isCaptionsEnabled.value = false;
		captions.currentTrack.value = null;
	}

	hls = new Hls();

	hls.loadSource(currentUrl.value);
	hls.attachMedia(videoElem.value);

	hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
		console.info("JellyfinPlayer: hls.js manifest parsed", data);
		emit("ready");

		addExternalSubtitleTracks();
		captions.captionsTracks.value = getCaptionsTracks();

		if (restoreTime !== undefined) {
			if (savedCaptionEnabled && savedCaptionTrack !== null) {
				setCaptionsTrack(savedCaptionTrack);
				setCaptionsEnabled(true);
			}
			if (videoElem.value) {
				videoElem.value.currentTime = restoreTime;
				if (autoPlay) {
					videoElem.value
						.play()
						.catch(e => console.warn("JellyfinPlayer: resume failed", e));
				}
			}
		}
	});

	hls.on(Hls.Events.ERROR, (event, data) => {
		console.error("JellyfinPlayer: hls.js error:", event, data);
		if (data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR) {
			console.warn("JellyfinPlayer: buffer full, skipping");
			return;
		}
		if (data.fatal) {
			switch (data.type) {
				case Hls.ErrorTypes.NETWORK_ERROR:
					console.error(
						"JellyfinPlayer: fatal network error encountered, try to recover",
					);
					hls?.startLoad();
					break;
				case Hls.ErrorTypes.MEDIA_ERROR:
					console.error("JellyfinPlayer: fatal media error encountered, try to recover");
					hls?.recoverMediaError();
					break;
				default:
					console.error("JellyfinPlayer: unrecoverable fatal error:", data);
					hls?.destroy();
					emit("error", {
						type: "unknown",
						message: data.error?.message || "Playback error",
					});
					break;
			}
		}
	});
}

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

onMounted(() => {
	videoElem.value ??= document.getElementById("jellyfinplayer") as HTMLVideoElement;
	initAudioTrack();
	loadVideoSource();
	emit("apiready");
});

onBeforeUnmount(() => {
	currentRequestId++;
	hls?.stopLoad();
	hls?.detachMedia();
	hls?.destroy();
	hls = undefined;
});

watch(videoUrl, () => {
	currentRequestId++;
	currentUrl.value = videoUrl.value;
	initAudioTrack();
	loadVideoSource();
});

watch(
	() => props.videoId,
	() => {
		currentRequestId++;
	},
);

watch(
	() => props.availableAudioTracks,
	() => {
		initAudioTrack();
	},
);

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
	isAudioSupported,
	getAudioTracks,
	getCurrentAudioTrack,
	setAudioTrack,
} satisfies MediaPlayerWithCaptions & MediaPlayerWithQuality & MediaPlayerWithPlaybackRate & MediaPlayerWithAudioBoost & MediaPlayerWithAudio);
</script>

<!-- biome-ignore lint/nursery/useScopedStyles: biome migration -->
<style lang="scss">
.jellyfin {
	display: flex;
	align-items: center;
	justify-content: center;
	max-width: 100%;
	max-height: 100%;
	width: 100%;
	height: 100%;
}

.jellyfin video {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: contain;
	object-position: 50% 50%;
}
</style>
