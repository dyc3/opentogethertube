import { it, describe, expect, afterEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import YoutubePlayer from "@/components/players/YoutubePlayer.vue";
// we need to import the mocks so mounting the component doesn't fail.
// eslint-disable-next-line no-unused-vars
import ResizeObserver from "./__mocks__/ResizeObserver";

describe("YoutubePlayer", () => {
	let wrapper;

	afterEach(async () => {
		if (wrapper) {
			await wrapper.unmount();
		}
	});

	it("should mount without failing", () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		expect(wrapper.find("#ytcontainer").exists()).toEqual(true);
	});

	it("should create try to create a new player after the iframe api is ready.", async () => {
		window.YT = {
			Player: vi.fn().mockImplementation(() => {
				return { test: true, destroy: vi.fn() };
			}),
		};
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		vi.spyOn(wrapper.vm, "fitToContainer").mockImplementation();
		await wrapper.vm.$nextTick();
		window.onYouTubeIframeAPIReady();
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.YT.Player).toHaveBeenCalled();
	});

	it("should emit the correct events", async () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		vi.spyOn(wrapper.vm, "fitToContainer").mockImplementation();
		wrapper.setData({
			player: {
				play: vi.fn(),
				pause: vi.fn(),
				seekTo: vi.fn(),
				setVolume: vi.fn(),
			},
		});
		wrapper.vm.onStateChange({ data: -1 });
		wrapper.vm.onStateChange({ data: 0 });
		wrapper.vm.onStateChange({ data: 1 });
		wrapper.vm.onStateChange({ data: 2 });
		wrapper.vm.onStateChange({ data: 3 });
		wrapper.vm.onStateChange({ data: 5 });
		for (let event of ["ended", "playing", "paused", "buffering", "ready"]) {
			expect(wrapper.emitted()).toHaveProperty(event);
		}
		wrapper.vm.onError();
		expect(wrapper.emitted()).toHaveProperty("error");
	});

	it("should use queued values when state changes", async () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		wrapper.setData({
			player: {
				play: vi.fn(),
				pause: vi.fn(),
				seekTo: vi.fn(),
				setVolume: vi.fn(),
			},
			queuedSeek: 10,
			queuedPlaying: true,
			queuedVolume: 50,
		});
		wrapper.vm.onStateChange({ data: 1 });
		expect(wrapper.vm.player.play).toHaveBeenCalled();
		expect(wrapper.vm.player.seekTo).toHaveBeenCalledWith(10);
		expect(wrapper.vm.player.setVolume).toHaveBeenCalledWith(50);
	});

	it("should set the size of the player to the size of the parent", () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		wrapper.setData({
			player: {
				getIframe: vi.fn().mockImplementation(() => {
					return {
						parentElement: {
							offsetWidth: 930,
							offsetHeight: 450,
						},
					};
				}),
				setSize: vi.fn(),
			},
		});
		wrapper.vm.fitToContainer();
		expect(wrapper.vm.player.setSize).toHaveBeenCalledWith(930, 450);
	});

	it("should queue values if player is not ready to receive the values yet", () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		wrapper.vm.play();
		expect(wrapper.vm.queuedPlaying).toEqual(true);
		wrapper.vm.pause();
		expect(wrapper.vm.queuedPlaying).toEqual(false);
		wrapper.vm.setPosition(54);
		expect(wrapper.vm.queuedSeek).toEqual(54);
		wrapper.vm.setVolume(84);
		expect(wrapper.vm.queuedVolume).toEqual(84);
	});
});
