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

/**
 * Handles sound effects.
 */
export class OttSfx {
	enabled: boolean = true;
	volume: Ref<number> = ref(1);

	private assets: Map<string, Blob> = new Map();
	private context: AudioContext = new AudioContext();

	async loadSfx() {
		const pop = await axios.get<Blob>(sfxPopUrl, { responseType: "blob" });
		this.assets.set("pop", pop.data);
	}

	async play(name: string) {
		if (!this.enabled) {
			return;
		}
		const asset = this.assets.get(name);
		if (!asset) {
			return;
		}
		const buffer = await asset.arrayBuffer();
		const source = this.context.createBufferSource();
		this.context.decodeAudioData(buffer, buffer => {
			source.buffer = buffer;
			source.connect(this.context.destination);
			source.start(0);
		});
	}
}

export const OttSfxPlugin: Plugin = (app: App, options) => {
	const connection = new OttSfx();
	app.provide(sfxInjectKey, connection);
};
