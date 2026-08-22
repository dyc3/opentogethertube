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
		></video>
	</div>
</template>

<script lang="ts" setup>
import Hls from "hls.js";
import { computed, onBeforeUnmount, onMounted, ref, toRefs, watch } from "vue";
import type { CaptionTrack, VideoTrack } from "@/models/media-tracks";
import type {
	MediaPlayerWithAudioBoost,
	MediaPlayerWithCaptions,
	MediaPlayerWithPlaybackRate,
	MediaPlayerWithQuality,
} from "../composables";
import { useCaptions, useMediaAudioBoost, useQualities } from "../composables";
import type { MediaPlayerError } from "../composables/media-player";

const JELLYFIN_BITRATE_PROFILES: VideoTrack[] = [
	{ label: "3 Mbps", width: 0, height: 0, bitrate: 3_000_000 },
	{ label: "1.5 Mbps", width: 0, height: 0, bitrate: 1_500_000 },
	{ label: "720 kbps", width: 0, height: 0, bitrate: 700_000 },
	{ label: "420 kbps", width: 0, height: 0, bitrate: 420_000 },
];

interface Props {
	videoUrl: string;
	thumbnail?: string;
	service?: string;
	availableSubtitles?: Array<{ url: string; label?: string; language?: string }>;
}

const props = withDefaults(defineProps<Props>(), {
	service: "",
	availableSubtitles: () => [],
});
const { videoUrl, thumbnail, service } = toRefs(props);
const videoElem = ref<HTMLVideoElement | undefined>();
const captions = useCaptions();
const qualities = useQualities();
const audioBoost = useMediaAudioBoost(videoElem);
const currentUrl = ref(props.videoUrl);
let hls: Hls | undefined;

const isJellyfin = computed(() => service.value === "jellyfin");

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
	if (!videoElem.value) {
		return;
	}
	const tracks = videoElem.value.textTracks;
	for (let i = 0; i < tracks.length; i++) {
		tracks[i].mode = enabled
			? i === captions.currentTrack.value
				? "showing"
				: "hidden"
			: "hidden";
	}
}

function isCaptionsEnabled(): boolean {
	if (!videoElem.value) {
		return false;
	}
	const tracks = videoElem.value.textTracks;
	for (let i = 0; i < tracks.length; i++) {
		if (tracks[i].mode === "showing") {
			return true;
		}
	}
	return false;
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
	if (!videoElem.value || !props.availableSubtitles || props.availableSubtitles.length === 0) {
		return;
	}
	const existingTracks = videoElem.value.querySelectorAll("track");
	for (const track of existingTracks) {
		track.remove();
	}
	for (const sub of props.availableSubtitles) {
		const track = document.createElement("track");
		track.kind = "subtitles";
		track.label = sub.label ?? `Subtitle ${sub.language ?? "und"}`;
		track.srclang = sub.language ?? "und";
		track.src = sub.url;
		videoElem.value.appendChild(track);
	}
	console.log("HlsPlayer: added external subtitle tracks:", props.availableSubtitles.length);
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
	return hls.levels.map(level => ({
		width: level.width,
		height: level.height,
	}));
}

function setJellyfinBitrate(bitrate: number | null): void {
	const url = new URL(videoUrl.value);
	if (bitrate === null) {
		url.searchParams.delete("VideoBitrate");
	} else {
		url.searchParams.set("VideoBitrate", String(bitrate));
	}
	currentUrl.value = url.toString();
	loadVideoSource();
}

function setVideoTrack(track: number): void {
	if (isJellyfin.value) {
		if (track === -1) {
			setJellyfinBitrate(null);
		} else {
			const profile = JELLYFIN_BITRATE_PROFILES[track];
			if (profile) {
				setJellyfinBitrate(profile.bitrate ?? null);
			}
		}
		qualities.currentVideoTrack.value = track;
		return;
	}

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

function setAudioBoost(boost: number): void {
	audioBoost.setBoost(boost);
}

function loadVideoSource() {
	console.log("HlsPlayer: loading video source:", currentUrl.value);

	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}
	audioBoost.resetFailedSetup();

	if (hls) {
		hls.destroy();
		hls = undefined;
	}

	const ms = videoElem.value.mediaSource;
	if (ms) {
		for (let i = 0; i < ms.sourceBuffers.length; i++) {
			const sb = ms.sourceBuffers[i];
			if (sb.updating) {
				sb.abort();
			}
			if (sb.buffered.length > 0) {
				sb.remove(sb.buffered.start(0), sb.buffered.end(sb.buffered.length - 1));
			}
		}
	}

	captions.captionsTracks.value = [];
	captions.isCaptionsEnabled.value = false;
	captions.currentTrack.value = null;

	hls = new Hls();

	hls.loadSource(currentUrl.value);
	hls.attachMedia(videoElem.value);

	hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
		console.info("HlsPlayer: hls.js manifest parsed", data);
		emit("ready");

		addExternalSubtitleTracks();
		captions.captionsTracks.value = getCaptionsTracks();
	});

	hls.on(Hls.Events.ERROR, (event, data) => {
		console.error("HlsPlayer: hls.js error:", event, data);
		console.error("HlsPlayer: hls.js inner error:", data.error);
		if (data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR) {
			console.warn("HlsPlayer: buffer full, skipping");
			return;
		}
		if (data.fatal) {
			console.error("HlsPlayer: hls.js fatal error:", data);
			const errorEvent: MediaPlayerError = {
				type: "unknown",
				message: JSON.stringify(data),
			};
			emit("error", errorEvent);
		}
	});

	hls.on(Hls.Events.INIT_PTS_FOUND, () => {
		console.info("HlsPlayer: hls.js init pts found");

		captions.captionsTracks.value = getCaptionsTracks();
		captions.isCaptionsEnabled.value = isCaptionsEnabled();

		if (isJellyfin.value) {
			qualities.videoTracks.value = JELLYFIN_BITRATE_PROFILES;
			qualities.isAutoQualitySupported.value = true;

			const url = new URL(currentUrl.value);
			const bitrateParam = url.searchParams.get("VideoBitrate");
			if (bitrateParam) {
				const bitrate = parseInt(bitrateParam, 10);
				const idx = JELLYFIN_BITRATE_PROFILES.findIndex(p => p.bitrate === bitrate);
				qualities.currentVideoTrack.value = idx >= 0 ? idx : -1;
				qualities.currentActiveQuality.value = idx >= 0 ? idx : null;
			} else {
				qualities.currentVideoTrack.value = -1;
				qualities.currentActiveQuality.value = null;
			}
		} else {
			qualities.videoTracks.value = getVideoTracks();
			qualities.currentVideoTrack.value = hls?.autoLevelEnabled
				? -1
				: hls?.currentLevel || -1;
			qualities.currentActiveQuality.value = getCurrentActiveQuality();
		}
	});

	hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
		console.info("HlsPlayer: hls.js level switched:", data);
		if (!isJellyfin.value) {
			qualities.currentActiveQuality.value = getCurrentActiveQuality();
		}
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

onBeforeUnmount(() => {
	hls?.destroy();
});

watch(videoUrl, () => {
	console.log("HlsPlayer: videoUrl changed");
	currentUrl.value = videoUrl.value;
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
} satisfies MediaPlayerWithCaptions & MediaPlayerWithQuality & MediaPlayerWithPlaybackRate & MediaPlayerWithAudioBoost);
</script>

<!-- biome-ignore lint/nursery/useScopedStyles: biome migration -->
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
