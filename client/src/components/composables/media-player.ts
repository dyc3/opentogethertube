import { useStore } from "@/store";
import { onMounted, ref, watch, type Ref } from "vue";

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

export abstract class MediaPlayerV2 {
	playing = ref(false);
	isCaptionsSupported = ref(false);

	abstract play(): Promise<void>;
	abstract pause(): Promise<void>;

	abstract getPosition(): number;
	abstract setPosition(position: number): void;
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
