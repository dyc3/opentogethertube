import Vue from 'vue';
import { shallowMount } from '@vue/test-utils';
import YoutubePlayer from "@/components/YoutubePlayer.vue";

describe("YoutubePlayer", () => {
	let wrapper;

	afterEach(async () => {
		await wrapper.destroy();
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
			Player: jest.fn().mockImplementation(() => {
				return { test: true, destroy: jest.fn() };
			}),
		};
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		jest.spyOn(wrapper.vm, 'fitToContainer').mockImplementation();
		await Vue.nextTick();
		window.onYouTubeIframeAPIReady();
		await Vue.nextTick();
		expect(wrapper.vm.YT.Player).toHaveBeenCalled();
	});

	it("should emit the correct events", async () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		jest.spyOn(wrapper.vm, 'fitToContainer').mockImplementation();
		wrapper.setData({
			player: {
				play: jest.fn(),
				pause: jest.fn(),
				seekTo: jest.fn(),
				setVolume: jest.fn(),
			},
		});
		wrapper.vm.onStateChange({ data: -1 });
		wrapper.vm.onStateChange({ data: 0 });
		wrapper.vm.onStateChange({ data: 1 });
		wrapper.vm.onStateChange({ data: 2 });
		wrapper.vm.onStateChange({ data: 3 });
		wrapper.vm.onStateChange({ data: 5 });
		expect(wrapper.emittedByOrder().map(e => e.name)).toEqual([
			'ended',
			'playing',
			'paused',
			'buffering',
			'ready',
		]);
		wrapper.vm.onError();
		expect(wrapper.emitted("error")).toHaveLength(1);
	});

	it("should use queued values when state changes", async () => {
		wrapper = shallowMount(YoutubePlayer, {
			props: {
				videoId: "pvoQg3QIvhA",
			},
		});
		jest.spyOn(wrapper.vm, 'fitToContainer').mockImplementation();
		wrapper.setData({
			player: {
				play: jest.fn(),
				pause: jest.fn(),
				seekTo: jest.fn(),
				setVolume: jest.fn(),
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
});
