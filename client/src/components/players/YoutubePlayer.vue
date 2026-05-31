<template>
	<div ref="rootElem" data-cy="youtube-player">
		<DebugPlayerWatcher v-if="isDev" :data="debugData" />
		<div ref="containerElem" class="youtube"></div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import DebugPlayerWatcher from "@/components/debug/DebugPlayerWatcher.vue";
import { getSdk } from "@/util/playerHelper.js";
import toast from "@/util/toast";
import { ToastStyle } from "@/models/toast";
import type { CaptionTrack } from "@/models/media-tracks";
import { useCaptions } from "../composables";

const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";

const YOUTUBE_STATUS_UNSTARTED = -1;
const YOUTUBE_STATUS_ENDED = 0;
const YOUTUBE_STATUS_PLAYING = 1;
const YOUTUBE_STATUS_PAUSED = 2;
const YOUTUBE_STATUS_BUFFERING = 3;
const YOUTUBE_STATUS_CUED = 5;

type YoutubeStatus =
	| typeof YOUTUBE_STATUS_UNSTARTED
	| typeof YOUTUBE_STATUS_ENDED
	| typeof YOUTUBE_STATUS_PLAYING
	| typeof YOUTUBE_STATUS_PAUSED
	| typeof YOUTUBE_STATUS_BUFFERING
	| typeof YOUTUBE_STATUS_CUED;

interface YoutubeSdk {
	Player: new (
		element: HTMLElement,
		options: {
			events: {
				onApiChange: () => void;
				onReady: () => void;
				onStateChange: (event: YoutubeStateChangeEvent) => void;
				onError: () => void;
			};
			playerVars: Record<string, number>;
		},
	) => YoutubePlayerApi;
}

interface YoutubeStateChangeEvent {
	data: YoutubeStatus;
}

interface YoutubeCaptionTrack {
	languageCode: string;
	languageName?: string;
}

interface YoutubePlayerApi {
	destroy?: () => void;
	playVideo: () => void;
	pauseVideo: () => void;
	getCurrentTime: () => number;
	seekTo: (position: number) => void;
	setVolume: (volume: number) => void;
	loadModule: (module: string) => void;
	unloadModule: (module: string) => void;
	getOption: (module: "captions", option: "tracklist") => YoutubeCaptionTrack[] | undefined;
	setOption: (module: "captions", option: "reload", value: boolean) => void;
	setOption: (module: "captions", option: "fontSize", value: number) => void;
	setOption: (module: "captions", option: "track", value: YoutubeCaptionTrack) => void;
	getAvailablePlaybackRates: () => number[];
	getPlaybackRate: () => number;
	setPlaybackRate: (rate: number) => void;
	loadVideoById: (videoId: string) => void;
	getVideoLoadedFraction: () => number;
	setSize: (width: string, height: string) => void;
}

interface Props {
	videoId: string;
}

/**
 * Component that manages youtube's iframe player (and all of the woes that come with it), and provides the common OTT player interface.
 *
 * When the broswser has blocked autoplay videos (firefox):
 * - Youtube player state: UNSTARTED
 * - Youtube player state: BUFFERING
 * - Youtube player state: UNSTARTED
 * - At this point, the user must interact with the video manually in order to play the video.
 */

defineOptions({ name: "YoutubePlayer" });

const props = defineProps<Props>();
const emit = defineEmits<{
	"apiready": [];
	"ended": [];
	"playing": [];
	"paused": [];
	"buffering": [];
	"ready": [];
	"error": [];
	"buffer-progress": [progress: number];
}>();

const isDev = import.meta.env.DEV;
const captions = useCaptions();
const rootElem = ref<HTMLElement>();
const containerElem = ref<HTMLElement>();
const player = ref<YoutubePlayerApi | null>(null);
const resizeObserver = ref<ResizeObserver | null>(null);
const youtubeState = ref<YoutubeStatus | null>(null);
const queuedSeek = ref<number | null>(null);
const queuedPlaying = ref<boolean | null>(null);
const queuedVolume = ref<number | null>(null);
const captionsEnabled = ref(false);
const isCaptionsLoaded = ref(false);

const debugData = computed(() => ({
	YoutubeState: youtubeState.value,
	queuedSeek: queuedSeek.value,
	queuedPlaying: queuedPlaying.value,
	isCaptionsEnabled: isCaptionsEnabled(),
	isCaptionsLoaded: isCaptionsLoaded.value,
}));

onMounted(async () => {
	const YT = (await getSdk(
		YOUTUBE_IFRAME_API_URL,
		"YT",
		"onYouTubeIframeAPIReady",
	)) as YoutubeSdk;

	if (!player.value && containerElem.value) {
		player.value = new YT.Player(containerElem.value, {
			events: {
				onApiChange,
				onReady,
				onStateChange,
				onError,
			},
			playerVars: {
				autoplay: 0,
				enablejsapi: 1,
				controls: 0,
				disablekb: 1,
				// required for iOS
				playsinline: 1,
			},
		});
	}

	if (rootElem.value) {
		resizeObserver.value = new ResizeObserver(fitToContainer);
		resizeObserver.value.observe(rootElem.value);
	}

	fitToContainer();
});

onBeforeUnmount(() => {
	resizeObserver.value?.disconnect();
	resizeObserver.value = null;
	player.value?.destroy?.();
	player.value = null;
});

watch(
	() => props.videoId,
	videoId => {
		if (!player.value) {
			return;
		}
		emit("buffering");
		player.value.loadVideoById(videoId);
		isCaptionsLoaded.value = false;
		captionsEnabled.value = false;
	},
);

function play(): Promise<void> {
	if (!player.value) {
		queuedPlaying.value = true;
		return Promise.resolve();
	}
	player.value.playVideo();
	return Promise.resolve();
}

function pause(): void {
	if (!player.value) {
		queuedPlaying.value = false;
		return;
	}
	player.value.pauseVideo();
}

function getPosition(): number {
	if (!player.value) {
		return 0;
	}
	return player.value.getCurrentTime();
}

function setPosition(position: number): void {
	if (!player.value) {
		queuedSeek.value = position;
		return;
	}
	player.value.seekTo(position);
}

function setVolume(volume: number): void {
	if (!player.value) {
		queuedVolume.value = volume;
		return;
	}
	player.value.setVolume(volume);
}

function isCaptionsSupported(): boolean {
	return true;
}

function isCaptionsEnabled(): boolean {
	return captionsEnabled.value;
}

function setCaptionsEnabled(value: boolean): void {
	if (!player.value) {
		return;
	}
	loadCaptionsIfNeeded();
	if (value) {
		player.value.loadModule("captions");
		player.value.setOption("captions", "fontSize", 0);
	} else {
		player.value.unloadModule("captions");
	}
	captionsEnabled.value = value;
}

function getRawCaptionsTracks(): YoutubeCaptionTrack[] {
	return player.value?.getOption("captions", "tracklist") ?? [];
}

function getCaptionsTracks(): CaptionTrack[] {
	return getRawCaptionsTracks().map(track => ({
		kind: "captions",
		label: track.languageName,
		srclang: track.languageCode,
	}));
}

function setCaptionsTrack(track: number): void {
	if (!player.value) {
		return;
	}
	loadCaptionsIfNeeded();
	const tracklist = getRawCaptionsTracks();
	console.debug("youtube: found tracks:", tracklist);
	const selectedTrack = tracklist[track];
	if (selectedTrack) {
		player.value.setOption("captions", "track", selectedTrack);
	} else {
		toast.add({
			content: `Unknown captions track ${track}`,
			style: ToastStyle.Error,
			duration: 4000,
		});
	}
}

function isQualitySupported(): boolean {
	return false;
}

function getAvailablePlaybackRates(): number[] {
	if (!player.value) {
		return [1];
	}
	return player.value.getAvailablePlaybackRates();
}

function getPlaybackRate(): number {
	if (!player.value) {
		return 1;
	}
	return player.value.getPlaybackRate();
}

function setPlaybackRate(rate: number): void {
	if (!player.value) {
		return;
	}
	player.value.setPlaybackRate(rate);
}

function onApiChange(): void {
	console.debug("youtube: onApiChange");
	captions.captionsTracks.value = getCaptionsTracks();
}

function onReady(): void {
	if (!player.value) {
		return;
	}
	emit("apiready");
	player.value.loadVideoById(props.videoId);
}

function onStateChange(event: YoutubeStateChangeEvent): void {
	if (!player.value) {
		return;
	}
	youtubeState.value = event.data;
	if (event.data === YOUTUBE_STATUS_ENDED) {
		emit("ended");
	} else if (event.data === YOUTUBE_STATUS_PLAYING) {
		emit("playing");
	} else if (event.data === YOUTUBE_STATUS_PAUSED) {
		emit("paused");
	} else if (event.data === YOUTUBE_STATUS_BUFFERING) {
		emit("buffering");
	} else if (event.data === YOUTUBE_STATUS_CUED) {
		emit("ready");
	}

	if (event.data === YOUTUBE_STATUS_PLAYING || event.data === YOUTUBE_STATUS_PAUSED) {
		if (queuedSeek.value !== null) {
			player.value.seekTo(queuedSeek.value);
			queuedSeek.value = null;
		}
		if (queuedPlaying.value !== null) {
			if (queuedPlaying.value) {
				player.value.playVideo();
			} else {
				player.value.pauseVideo();
			}
			queuedPlaying.value = null;
		}
		if (queuedVolume.value !== null) {
			player.value.setVolume(queuedVolume.value);
			queuedVolume.value = null;
		}
	}

	emit("buffer-progress", player.value.getVideoLoadedFraction());
}

function onError(): void {
	emit("error");
}

function fitToContainer(): void {
	if (!player.value) {
		return;
	}
	player.value.setSize("100%", "100%");
}

function loadCaptionsIfNeeded(): void {
	if (!player.value || isCaptionsLoaded.value) {
		return;
	}
	player.value.setOption("captions", "reload", true);
	isCaptionsLoaded.value = true;
}

defineExpose({
	play,
	pause,
	getPosition,
	setPosition,
	setVolume,
	isCaptionsSupported,
	isCaptionsEnabled,
	setCaptionsEnabled,
	getCaptionsTracks,
	setCaptionsTrack,
	isQualitySupported,
	getAvailablePlaybackRates,
	getPlaybackRate,
	setPlaybackRate,
});
</script>
