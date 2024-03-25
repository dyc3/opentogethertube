import { useStore } from "@/store";
import { computed, onMounted, ref, watch, type Ref } from "vue";

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

// export class MediaController {
// 	player: MediaPlayerV2  | null = null;
// 	isCaptionsSupported = computed(() => this.player?.isCaptionsSupported.value ?? false);

// 	setPlayer(player: MediaPlayerV2) {
// 		this.player = player;
// 	}

// 	async play() {
// 		if (this.player) {
// 			await this.player.play();
// 		}
// 	}

// 	async pause() {
// 		if (this.player) {
// 			await this.player.pause();
// 		}
// 	}

// 	getPosition() {
// 		return this.player ? this.player.getPosition() : 0;
// 	}

// 	setPosition(position: number) {
// 		if (this.player) {
// 			this.player.setPosition(position);
// 		}
// 	}
// }

export abstract class MediaPlayerV2 {
	playing = ref(false);
	isCaptionsSupported = ref(false);

	abstract play(): Promise<void>;
	abstract pause(): Promise<void>;

	abstract getPosition(): number;
	abstract setPosition(position: number): void;

	getAvailablePlaybackRates(): number[] {
		return [1];
	}
}

const player: Ref<MediaPlayerV2 | undefined> = ref(undefined);

export function useMediaPlayer() {
	return player;
}

export function isPlayerPresent(p: typeof player): p is Ref<MediaPlayerV2> {
	return !!p.value;
}

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
