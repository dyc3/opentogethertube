import type { InjectionKey, Ref } from "vue";

export const VOLUME_KEY: InjectionKey<[Ref<number>, (value: number) => {}]> = Symbol("volume");
