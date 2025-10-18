import { useStore } from "@/store";
import { onMounted, ref, watch, type Ref, shallowRef, provide, inject, computed } from "vue";
import type { VideoTrack, CaptionTrack } from "@/models/media-tracks";

const volume = ref(100);

export function useVolume() {
	const store = useStore();

	onMounted(() => {
		volume.value = store.state.settings.volume;
	});

	watch(volume, () => {
		store.commit("settings/UPDATE", { volume: volume.value });
	});

	return volume;
}

export interface MediaPlayer {
	/**
	 * Play the video.
	 *
	 * Some browsers emit promises for this, and some don't.
	 */
	play(): void | Promise<void>;
	/**
	 * Pause the video.
	 *
	 * Some browsers emit promises for this, and some don't.
	 */
	pause(): void | Promise<void>;
	setVolume(volume: number): void | Promise<void>;
	getPosition(): number;
	setPosition(position: number): void;

	isCaptionsSupported(): boolean;
	isQualitySupported(): boolean;
	getAvailablePlaybackRates(): number[];
}

export interface MediaPlayerWithCaptions extends MediaPlayer {
	isCaptionsEnabled(): boolean;
	setCaptionsEnabled(enabled: boolean): void;
	getCaptionsTracks(): CaptionTrack[];
	setCaptionsTrack(track: number): void;
}

export interface MediaPlayerWithPlaybackRate extends MediaPlayer {
	getPlaybackRate(): number;
	setPlaybackRate(rate: number): void;
}

export interface MediaPlayerWithQuality extends MediaPlayer {
	getVideoTracks(): VideoTrack[];
	setVideoTrack(idx: number): void;
	isAutoQualitySupported(): boolean;
	getCurrentActiveQuality(): number | null;
}

export class MediaPlayerV2 {
	player: Ref<MediaPlayer | null> = shallowRef(null);
	apiReady = ref(false);
	playing = ref(false);
	isCaptionsSupported = ref(false);

	setPlayer(player: MediaPlayer | null) {
		this.apiReady.value = false;
		this.player.value = player;
	}

	checkForPlayer(p: MediaPlayer | null): p is MediaPlayer {
		if (!p) {
			return false;
		}
		return this.apiReady.value ?? false;
	}

	isPlayerPresent(): boolean {
		return !!this.player.value;
	}

	markApiReady() {
		if (!this.player.value) {
			// FIXME: im not sure if this branch gets taken anymore
			new Promise(resolve => {
				const stop = watch(this.player, newPlayer => {
					if (newPlayer) {
						stop();
						resolve(true);
					}
				});
			}).then(() => {
				this.apiReady.value = true;
			});
		} else {
			this.apiReady.value = true;
		}
	}

	async play(): Promise<void> {
		if (!this.checkForPlayer(this.player.value)) {
			return Promise.reject("Player not available yet");
		}
		return this.player.value.play();
	}
	async pause(): Promise<void> {
		if (!this.checkForPlayer(this.player.value)) {
			return Promise.reject("Player not available yet");
		}
		return this.player.value.pause();
	}
	getPosition(): number | Promise<number> {
		// vimeo video player returns a promise, so we need to handle that
		if (!this.checkForPlayer(this.player.value)) {
			return 0;
		}
		return this.player.value.getPosition();
	}
	setPosition(position: number): void {
		if (!this.checkForPlayer(this.player.value)) {
			return;
		}
		return this.player.value.setPosition(position);
	}
}

const PLAYER_KEY = Symbol("player");
const player = new MediaPlayerV2();

export function useMediaPlayer() {
	return inject(PLAYER_KEY, player);
}

const isCaptionsSupported: Ref<boolean> = ref(false);
const isCaptionsEnabled: Ref<boolean> = ref(false);
const captionsTracks: Ref<CaptionTrack[]> = ref([]);
const currentTrack: Ref<number | null> = ref(null);

export function useCaptions() {
	return {
		isCaptionsSupported,
		isCaptionsEnabled,
		captionsTracks,
		currentTrack,
	};
}

const isQualitySupported: Ref<boolean> = ref(false);
const videoTracks: Ref<VideoTrack[]> = ref([]);
const currentVideoTrack: Ref<number> = ref(-1);
const isAutoQualitySupported: Ref<boolean> = ref(false);
const currentActiveQuality: Ref<number | null> = ref(null);

export function useQualities() {
	return {
		isQualitySupported,
		videoTracks,
		currentVideoTrack,
		isAutoQualitySupported,
		currentActiveQuality,
	};
}

const playbackRate: Ref<number> = ref(1);
const availablePlaybackRates: Ref<number[]> = ref([1]);
const isPlaybackRateSupported = computed(() => {
	return availablePlaybackRates.value.length > 1;
});

export function usePlaybackRate() {
	return {
		isPlaybackRateSupported,
		playbackRate,
		availablePlaybackRates,
	};
}

export interface MediaPlayerError {
	type: "unknown";
	message?: string;
}
