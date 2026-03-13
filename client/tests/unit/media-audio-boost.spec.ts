import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaAudioBoost } from "../../src/components/composables/media-audio-boost";

describe("useMediaAudioBoost", () => {
	const originalWarn = console.warn;

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		console.warn = originalWarn;
	});

	function makeContext(options?: { state?: AudioContextState; throwOnSource?: boolean }) {
		const gain = {
			gain: { value: 0 },
			connect: vi.fn(),
			disconnect: vi.fn(),
		} as unknown as GainNode;
		const source = {
			connect: vi.fn(),
			disconnect: vi.fn(),
		} as unknown as MediaElementAudioSourceNode;
		const context = {
			state: options?.state ?? "running",
			createGain: vi.fn(() => gain),
			createMediaElementSource: vi.fn(() => {
				if (options?.throwOnSource) {
					throw new Error("source failed");
				}
				return source;
			}),
			destination: {} as AudioDestinationNode,
			close: vi.fn(async () => undefined),
			resume: vi.fn(async () => undefined),
		} as unknown as AudioContext;

		return { context, gain, source };
	}

	function mountComposable(createContext: () => AudioContext) {
		let api: ReturnType<typeof useMediaAudioBoost> | undefined;

		const wrapper = mount(
			defineComponent({
				setup() {
					const mediaElement = ref<HTMLVideoElement>();
					api = useMediaAudioBoost(mediaElement, createContext);
					return { mediaElement };
				},
				template: '<video ref="mediaElement"></video>',
			})
		);

		if (!api) {
			throw new Error("Failed to initialize audio boost composable");
		}

		return {
			wrapper,
			api,
		};
	}

	it("keeps gain neutral at 100% boost", () => {
		const { context } = makeContext();
		const factory = vi.fn(() => context);
		const { api } = mountComposable(factory);

		api.setBoost(100);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(api.source.value).toBeDefined();
		expect(api.gain.value?.gain.value ?? 0).toBe(1);
	});

	it("creates the graph once and clamps gain up to 300%", () => {
		const { context, gain, source } = makeContext();
		const { api } = mountComposable(() => context);

		api.setBoost(250);
		api.setBoost(350);

		expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
		expect(context.createGain).toHaveBeenCalledTimes(1);
		expect(source.connect).toHaveBeenCalledWith(gain);
		expect(gain.connect).toHaveBeenCalledWith(context.destination);
		expect(gain.gain.value).toBe(3);
	});

	it("resumes suspended contexts and disconnects on unmount", () => {
		const { context, gain, source } = makeContext({ state: "suspended" });
		const { api, wrapper } = mountComposable(() => context);

		api.setBoost(200);
		wrapper.unmount();

		expect(context.resume).toHaveBeenCalledTimes(1);
		expect(source.disconnect).toHaveBeenCalledTimes(1);
		expect(gain.disconnect).toHaveBeenCalledTimes(1);
		expect(context.close).toHaveBeenCalledTimes(1);
	});

	it("fails gracefully and stops retrying until reset", () => {
		const { context } = makeContext({ throwOnSource: true });
		const { api } = mountComposable(() => context);

		expect(() => api.setBoost(200)).not.toThrow();
		expect(() => api.setBoost(300)).not.toThrow();

		expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
		expect(console.warn).toHaveBeenCalled();
	});

	it("can retry setup after a failed source change", () => {
		let shouldThrow = true;
		const { context, gain } = makeContext();
		vi.spyOn(context, "createMediaElementSource").mockImplementation(() => {
			if (shouldThrow) {
				throw new Error("source failed");
			}
			return {
				connect: vi.fn(),
				disconnect: vi.fn(),
			} as unknown as MediaElementAudioSourceNode;
		});
		const { api } = mountComposable(() => context);

		expect(() => api.setBoost(200)).not.toThrow();
		shouldThrow = false;
		api.resetFailedSetup();
		api.setBoost(200);

		expect(context.createMediaElementSource).toHaveBeenCalledTimes(2);
		expect(gain.gain.value).toBe(2);
	});
});
