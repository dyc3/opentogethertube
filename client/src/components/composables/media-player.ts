import { useStore } from "@/store";
import { onMounted, ref, watch, type Ref, shallowRef, provide, inject } from "vue";
import type { MediaPlayer } from "../players/OmniPlayer.vue";

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

export class MediaPlayerV2 {
	player: Ref<MediaPlayer | null> = shallowRef(null);
	apiReady = ref(false);
	playing = ref(false);
	isCaptionsSupported = ref(false);

	setPlayer(player: MediaPlayer | null) {
		this.player.value = player;
	}

	checkForPlayer(p: MediaPlayer | null): p is MediaPlayer {
		if (!p) {
			return false;
		}
		return this.apiReady.value ?? false;
	}

	isPlayerPresent(): boolean {
		return this.checkForPlayer(this.player.value);
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
	getPosition(): number {
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

// export function isPlayerPresent(p: typeof player): p is Ref<MediaPlayerV2> {
// 	return !!p.value;
// }

const isCaptionsSupported: Ref<boolean> = ref(false);
const isCaptionsEnabled: Ref<boolean> = ref(false);
const captionsTracks: Ref<string[]> = ref([]);
const currentTrack: Ref<string | null> = ref(null);

export function useCaptions() {
	return {
		isCaptionsSupported,
		isCaptionsEnabled,
		captionsTracks,
		currentTrack,
	};
}

const isPlaybackRateSupported: Ref<boolean> = ref(false);
const playbackRate: Ref<number> = ref(1);
const availablePlaybackRates: Ref<number[]> = ref([1]);

export function usePlaybackRate() {
	return {
		isPlaybackRateSupported,
		playbackRate,
		availablePlaybackRates,
	};
}
