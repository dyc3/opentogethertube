<template>
	<div class="hls">
		<video
			id="hlsplayer"
			preload="auto"
			crossorigin="anonymous"
			:poster="thumbnail || ''"
			@canplay="playerEvents.onReady"
			@ready="playerEvents.onReady"
			@playing="playerEvents.onPlaying"
			@pause="playerEvents.onPaused"
			@stalled="playerEvents.onBuffering"
			@loadstart="playerEvents.onBuffering"
			@progress="playerEvents.onProgress"
			@ended="playerEvents.onEnd"
			@error="playerEvents.onError"
		></video>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, onBeforeUnmount, toRefs } from "vue";
import Hls from "hls.js";
import type { MediaPlayerWithCaptions, MediaPlayerWithPlaybackRate } from "../composables";
import { useCaptions } from "../composables";

interface Props {
	videoUrl: string;
	thumbnail?: string;
}

const props = defineProps<Props>();
const { videoUrl, thumbnail } = toRefs(props);
const videoElem = ref<HTMLVideoElement | undefined>();
const captions = useCaptions();
const hls = ref<Hls | undefined>(undefined);

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

const playerImpl: MediaPlayerWithCaptions & MediaPlayerWithPlaybackRate = {
	play() {
		if (!videoElem.value) {
			console.error("player not ready");
			return;
		}
		return videoElem.value.play();
	},
	pause() {
		if (!videoElem.value) {
			console.error("player not ready");
			return;
		}
		videoElem.value.pause();
	},
	setVolume(volume: number) {
		if (!videoElem.value) {
			console.error("player not ready");
			return;
		}
		videoElem.value.volume = volume / 100;
	},
	getPosition() {
		if (!videoElem.value) {
			console.error("player not ready");
			return 0;
		}
		return videoElem.value.currentTime;
	},
	setPosition(position: number) {
		if (!videoElem.value) {
			console.error("player not ready");
			return;
		}
		videoElem.value.currentTime = position;
	},
	isCaptionsSupported(): boolean {
		return true;
	},
	setCaptionsEnabled(enabled: boolean): void {
		if (!hls.value) {
			return;
		}
		if (!enabled) {
			hls.value.subtitleTrack = -1;
		}
	},
	isCaptionsEnabled(): boolean {
		if (!hls.value) {
			return false;
		}
		return hls.value.subtitleTrack !== -1;
	},
	getCaptionsTracks(): string[] {
		console.log("HlsPlayer: getCaptionsTracks:", hls.value?.subtitleTracks);
		return hls.value?.subtitleTracks.map(track => track.name) || [];
	},
	setCaptionsTrack(track: string): void {
		if (!hls.value) {
			console.error("HlsPlayer: player not ready");
			return;
		}
		console.log("HlsPlayer: setCaptionsTrack:", track);
		const trackIdx = hls.value.subtitleTracks.findIndex(t => t.name === track);
		if (trackIdx === -1) {
			console.error("HlsPlayer: HLS.js captions track not found:", track);
			return;
		}
		console.log("HlsPlayer: setting HLS.js captions track:", trackIdx);
		hls.value.subtitleTrack = trackIdx;
	},
	getAvailablePlaybackRates(): number[] {
		return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
	},
	getPlaybackRate(): number {
		if (!videoElem.value) {
			console.error("player not ready");
			return 1;
		}
		return videoElem.value.playbackRate;
	},
	async setPlaybackRate(rate: number): Promise<void> {
		if (!videoElem.value) {
			console.error("player not ready");
			return;
		}
		videoElem.value.playbackRate = rate;
	},
};

const playerEvents = {
	onReady() {
		emit("ready");
	},
	onPlaying() {
		emit("playing");
	},
	onPaused() {
		emit("paused");
	},
	onBuffering() {
		emit("buffering");
	},
	onProgress() {
		if (videoElem.value) {
			const buffered = videoElem.value.buffered;
			emit("buffer-spans", buffered);
			const duration = videoElem.value.duration;
			const bufferedPercentage =
				buffered && buffered.length && duration > 0 ? buffered.end(0) / duration : 0;
			emit("buffer-progress", bufferedPercentage);
		}
	},
	onEnd() {
		emit("end");
	},
	onError(err: Event) {
		emit("error");
		console.error("HlsPlayer: video element error:", err);
	},
};

function loadVideoSource() {
	console.log("HlsPlayer: loading video source:", videoUrl.value);

	if (!videoElem.value) {
		console.error("video element not ready");
		return;
	}

	hls.value?.destroy();
	hls.value = undefined;

	hls.value = new Hls();

	hls.value.loadSource(videoUrl.value);
	hls.value.attachMedia(videoElem.value);

	hls.value.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
		console.info("HlsPlayer: hls.js manifest parsed", data);
		emit("ready");
	});

	hls.value.on(Hls.Events.ERROR, (event, data) => {
		console.error("HlsPlayer: hls.js error:", event, data);
		console.error("HlsPlayer: hls.js inner error:", data.error);
		emit("error");
	});

	hls.value.on(Hls.Events.INIT_PTS_FOUND, () => {
		console.info("HlsPlayer: hls.js init pts found");
		captions.captionsTracks.value = playerImpl.getCaptionsTracks();
		captions.isCaptionsEnabled.value = playerImpl.isCaptionsEnabled();
		console.log("HlsPlayer: current subtitle track:", hls.value?.subtitleTrack);
		captions.currentTrack.value = captions.captionsTracks.value[hls.value?.subtitleTrack || 0] || "";
	});

	hls.value.on(Hls.Events.SUBTITLE_TRACK_LOADED, (_, data) => {
		console.info("HlsPlayer: hls.js subtitle track loaded:", data);
	});

	hls.value.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
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

onBeforeUnmount(() => {
	hls.value?.destroy();
});

watch(videoUrl, () => {
	console.log("HlsPlayer: videoUrl changed");
	loadVideoSource();
});

defineExpose({
	...playerImpl,
});
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
