import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YoutubePlayer from "@/components/players/YoutubePlayer.vue";
import { useCaptions } from "@/components/composables";
import { getSdk } from "@/util/playerHelper.js";

vi.mock("@/util/playerHelper.js", () => ({ getSdk: vi.fn() }));

describe("YouTube captions", () => {
	let events: {
		onReady: () => void;
		onApiChange: () => void;
		onStateChange: (event: { data: number }) => void;
	};
	let visible: boolean;
	let captionsModuleLoaded: boolean;
	let pendingApiChanges: number;
	let wrapper: VueWrapper;
	const captions = useCaptions();

	// YouTube can restore captions on playback transitions without onApiChange.
	const transition = (data: number) => {
		visible = true;
		captionsModuleLoaded = true;
		events.onStateChange({ data });
	};
	const flushApiChanges = () => {
		for (let i = 0; pendingApiChanges > 0; i++) {
			if (i === 10) {
				throw new Error("Caption module callbacks did not settle");
			}
			pendingApiChanges--;
			events.onApiChange();
		}
	};
	const api = {
		loadModule: vi.fn(() => {
			visible = true;
			captionsModuleLoaded = true;
			pendingApiChanges++;
		}),
		unloadModule: vi.fn(() => {
			visible = false;
			captionsModuleLoaded = false;
			// Do not assume repeated unloads suppress the documented API-change callback.
			pendingApiChanges++;
		}),
		getOptions: vi.fn(() => (captionsModuleLoaded ? ["captions"] : [])),
		setOption: vi.fn(),
		getOption: vi.fn(() => []),
		loadVideoById: vi.fn(),
		cueVideoById: vi.fn(),
		playVideo: vi.fn(() => transition(1)),
		pauseVideo: vi.fn(() => transition(2)),
		seekTo: vi.fn(() => transition(2)),
		getCurrentTime: vi.fn(() => 10),
		setVolume: vi.fn(),
		getVideoLoadedFraction: vi.fn(() => 1),
		setSize: vi.fn(),
		destroy: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		visible = true;
		captionsModuleLoaded = true;
		pendingApiChanges = 0;
		captions.isCaptionsEnabled.value = false;
		captions.currentTrack.value = null;
		captions.captionsTracks.value = [];
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe = vi.fn();
				disconnect = vi.fn();
			},
		);
		vi.mocked(getSdk).mockResolvedValue({
			Player: vi.fn((_element: HTMLElement, options: { events: typeof events }) => {
				events = options.events;
				return api;
			}),
		});
	});

	afterEach(() => {
		wrapper?.unmount();
		vi.unstubAllGlobals();
	});

	const mountPlayer = async (ready = true) => {
		wrapper = mount(YoutubePlayer, {
			props: { videoId: "H14bBuluwB8" },
			global: { stubs: { DebugPlayerWatcher: true } },
		});
		await flushPromises();
		if (ready) {
			events.onReady();
			events.onApiChange();
			flushApiChanges();
		}
		return wrapper.vm.$.exposed as unknown as {
			setCaptionsEnabled: (enabled: boolean) => void;
			isCaptionsEnabled: () => boolean;
			play: () => Promise<void>;
			pause: () => void;
			setPosition: (position: number) => void;
		};
	};

	it("applies the initial preference only after the player is ready", async () => {
		captions.isCaptionsEnabled.value = true;
		visible = false;
		const player = await mountPlayer(false);
		expect(player.isCaptionsEnabled()).toBe(false);
		expect(api.loadModule).not.toHaveBeenCalled();

		events.onReady();
		expect(api.loadModule).toHaveBeenCalledWith("captions");
		expect(visible).toBe(true);
		expect(player.isCaptionsEnabled()).toBe(true);
		events.onApiChange();
		await player.play();
		expect(api.loadModule).toHaveBeenCalledTimes(1);
	});

	it("defers applying preference changes until ready", async () => {
		const player = await mountPlayer(false);
		captions.isCaptionsEnabled.value = true;
		player.setCaptionsEnabled(true);
		expect(player.isCaptionsEnabled()).toBe(false);
		expect(api.loadModule).not.toHaveBeenCalled();
		captions.isCaptionsEnabled.value = false;
		player.setCaptionsEnabled(false);
		expect(api.unloadModule).not.toHaveBeenCalled();

		events.onReady();
		expect(visible).toBe(false);
		expect(api.loadModule).not.toHaveBeenCalled();
	});

	it("applies an enable request made before readiness", async () => {
		const player = await mountPlayer(false);
		visible = false;
		captions.isCaptionsEnabled.value = true;
		player.setCaptionsEnabled(true);
		expect(player.isCaptionsEnabled()).toBe(false);

		events.onReady();
		expect(visible).toBe(true);
		expect(player.isCaptionsEnabled()).toBe(true);
	});

	it("reads the current shared preference at readiness instead of its value at mount", async () => {
		const player = await mountPlayer(false);
		captions.isCaptionsEnabled.value = true;
		visible = false;

		events.onReady();
		expect(visible).toBe(true);
		expect(player.isCaptionsEnabled()).toBe(true);
	});

	it("uses the current shared preference when restoring captions", async () => {
		captions.isCaptionsEnabled.value = true;
		const player = await mountPlayer();
		captions.isCaptionsEnabled.value = false;

		await player.play();
		expect(visible).toBe(false);
		expect(player.isCaptionsEnabled()).toBe(false);
	});

	it("disables automatically loaded captions when the preference is off", async () => {
		await mountPlayer();
		expect(visible).toBe(false);
	});

	it("keeps captions off after pausing, resuming, and seeking", async () => {
		const player = await mountPlayer();
		captions.isCaptionsEnabled.value = true;
		player.setCaptionsEnabled(true);
		expect(visible).toBe(true);
		captions.isCaptionsEnabled.value = false;
		player.setCaptionsEnabled(false);
		expect(visible).toBe(false);

		player.pause();
		await player.play();
		expect(visible).toBe(false);

		player.setPosition(30);
		expect(visible).toBe(false);
		expect(player.isCaptionsEnabled()).toBe(false);

		captions.isCaptionsEnabled.value = true;
		player.setCaptionsEnabled(true);
		await player.play();
		expect(visible).toBe(true);
	});

	it("reapplies off when YouTube reloads its caption module", async () => {
		const player = await mountPlayer();
		captions.isCaptionsEnabled.value = false;
		player.setCaptionsEnabled(false);
		visible = true;
		captionsModuleLoaded = true;
		events.onApiChange();
		flushApiChanges();
		expect(visible).toBe(false);
	});

	it("settles after unloading captions and handles a later silent restoration", async () => {
		const player = await mountPlayer();
		expect(api.unloadModule).toHaveBeenCalledTimes(1);
		expect(api.getOptions()).toEqual([]);

		events.onApiChange();
		player.setCaptionsEnabled(false);
		flushApiChanges();
		expect(api.unloadModule).toHaveBeenCalledTimes(1);

		await player.play();
		flushApiChanges();
		expect(api.unloadModule).toHaveBeenCalledTimes(2);
		expect(visible).toBe(false);
		expect(player.isCaptionsEnabled()).toBe(false);
	});

	it("does not reload captions when turning them off", async () => {
		const player = await mountPlayer();
		api.setOption.mockClear();
		captions.isCaptionsEnabled.value = false;
		player.setCaptionsEnabled(false);
		expect(api.setOption).not.toHaveBeenCalledWith("captions", "reload", true);
	});

	it("retains enabled captions across video changes", async () => {
		captions.isCaptionsEnabled.value = true;
		const player = await mountPlayer();
		expect(player.isCaptionsEnabled()).toBe(true);
		await wrapper.setProps({ videoId: "another-video" });
		expect(player.isCaptionsEnabled()).toBe(false);
		visible = false;
		api.loadModule.mockClear();
		events.onApiChange();
		expect(api.loadModule).toHaveBeenCalledWith("captions");
		await player.play();
		expect(player.isCaptionsEnabled()).toBe(true);
		expect(visible).toBe(true);
	});
});
