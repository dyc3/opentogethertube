import { inject, InjectionKey, App, Plugin, ref, Ref } from "vue";
import axios from "axios";

export const sfxInjectKey: InjectionKey<OttSfx> = Symbol("ott:sfx");

export function useSfx(): OttSfx {
	const sfx = inject(sfxInjectKey);
	if (!sfx) {
		throw new Error("No sfx available, did you forget to install the plugin?");
	}
	return sfx;
}

import sfxPopUrl from "../assets/sfx/pop.ogg?url";
import { watch } from "vue";

/**
 * Handles sound effects.
 */
export class OttSfx {
	enabled: boolean = true;
	volume: Ref<number> = ref(1);
	private loaded: boolean = false;

	private assets: Map<string, AudioBuffer> = new Map();
	private context: AudioContext = new AudioContext();
	private gain: GainNode = this.context.createGain();

	constructor() {
		this.gain.connect(this.context.destination);

		watch(this.volume, () => {
			this.gain.gain.value = this.volume.value;
		});
	}

	async loadSfx() {
		const pop = await axios.get<Blob>(sfxPopUrl, { responseType: "blob" });
		await this.registerBlob("pop", pop.data);
		this.loaded = true;
	}

	private async registerBlob(name: string, blob: Blob) {
		const buf = await blob.arrayBuffer();
		const buffer = new Promise<AudioBuffer>((resolve, reject) => {
			this.context.decodeAudioData(
				buf,
				buffer => {
					resolve(buffer);
				},
				err => {
					console.error("Failed to decode audio data", err);
					reject(err);
				}
			);
		});
		this.assets.set(name, await buffer);
	}

	async play(name: string) {
		if (!this.enabled || !this.loaded) {
			return;
		}
		const asset = this.assets.get(name);
		if (!asset) {
			return;
		}
		const source = this.context.createBufferSource();
		source.buffer = asset;
		source.connect(this.gain);
		source.start(0);
	}
}

export const OttSfxPlugin: Plugin = (app: App, options) => {
	const connection = new OttSfx();
	app.provide(sfxInjectKey, connection);
};
