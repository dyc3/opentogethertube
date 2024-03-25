import { useStore } from "@/store";
import { onMounted, ref, watch } from "vue";

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

export class MediaController {
	player: MediaPlayerV2 | null = null;

	setPlayer(player: MediaPlayerV2) {
		this.player = player;
	}

	async play() {
		if (this.player) {
			await this.player.play();
		}
	}

	async pause() {
		if (this.player) {
			await this.player.pause();
		}
	}

	getPosition() {
		return this.player ? this.player.getPosition() : 0;
	}

	setPosition(position: number) {
		if (this.player) {
			this.player.setPosition(position);
		}
	}
}

export abstract class MediaPlayerV2 {
	playing = ref(false);

	abstract play(): Promise<void>;
	abstract pause(): Promise<void>;

	abstract getPosition(): number;
	abstract setPosition(position: number): void;
}

export const mediaController = new MediaController();

export function useMediaControls() {
	return mediaController;
}
