import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAudioTracks } from "@/components/composables/media-player";
import JellyfinPlayer from "@/components/players/JellyfinPlayer.vue";
import { API } from "@/common-http";

vi.mock("@/common-http", () => ({
	API: {
		post: vi.fn(),
		get: vi.fn(),
	},
}));

vi.mock("vue-router", () => ({
	useRoute: () => ({
		params: { name: "testroom" },
	}),
}));

vi.mock("@/store", () => ({
	useStore: () => ({
		state: {
			room: { name: "testroom" },
			settings: { audioBoost: 100, volume: 100, muted: false },
		},
		commit: vi.fn(),
	}),
}));

vi.stubGlobal(
	"AudioContext",
	vi.fn().mockImplementation(() => ({
		state: "running",
		createGain: vi.fn(() => ({
			gain: { value: 0 },
			connect: vi.fn(),
			disconnect: vi.fn(),
		})),
		createMediaElementSource: vi.fn(() => ({
			connect: vi.fn(),
			disconnect: vi.fn(),
		})),
		destination: {},
		close: vi.fn(async () => undefined),
		resume: vi.fn(async () => undefined),
	})),
);

vi.mock("hls.js", () => {
	class MockHls {
		static Events = {
			MANIFEST_PARSED: "hlsManifestParsed",
			ERROR: "hlsError",
		};
		static ErrorTypes = {
			NETWORK_ERROR: "networkError",
			MEDIA_ERROR: "mediaError",
		};
		static ErrorDetails = {
			BUFFER_FULL_ERROR: "bufferFullError",
		};

		loadSource = vi.fn();
		attachMedia = vi.fn();
		destroy = vi.fn();
		stopLoad = vi.fn();
		detachMedia = vi.fn();
		on = vi.fn();
		off = vi.fn();
		once = vi.fn((_event, cb) => cb?.());
	}
	return { default: MockHls };
});

describe("Audio Tracks Composable & JellyfinPlayer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("useAudioTracks should manage audio track state", () => {
		const audio = useAudioTracks();
		audio.isAudioSupported.value = true;
		audio.audioTracks.value = [
			{ index: 1, label: "English", language: "eng", isDefault: true },
			{ index: 2, label: "Spanish", language: "spa" },
		];
		audio.currentAudioTrack.value = 1;

		expect(audio.isAudioSupported.value).toBe(true);
		expect(audio.audioTracks.value).toHaveLength(2);
		expect(audio.currentAudioTrack.value).toBe(1);
	});

	const TestParent = (props: Record<string, unknown>) =>
		mount(
			{
				components: { JellyfinPlayer },
				setup() {
					const playerRef = ref();
					return { playerRef };
				},
				template: '<JellyfinPlayer ref="playerRef" v-bind="$attrs" />',
			},
			{
				attrs: props,
				attachTo: document.body,
			},
		);

	it("JellyfinPlayer mounts and exposes MediaPlayer methods", async () => {
		const wrapper = TestParent({
			videoUrl: "https://my.jellyfin.com/Videos/123/master.m3u8",
			videoId: "https://my.jellyfin.com::item123::key123",
			availableAudioTracks: [
				{ index: 1, label: "English", language: "eng", isDefault: true },
				{ index: 2, label: "Spanish", language: "spa" },
			],
		});

		const player = wrapper.vm.playerRef;
		expect(player.isAudioSupported()).toBe(true);
		expect(player.getAudioTracks()).toHaveLength(2);
		expect(player.getCurrentAudioTrack()).toBe(1);
		wrapper.unmount();
	});

	it("JellyfinPlayer setAudioTrack refreshes stream and updates track", async () => {
		vi.mocked(API.post).mockResolvedValueOnce({
			data: {
				success: true,
				// eslint-disable-next-line camelcase
				hls_url: "https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=2",
				playbackType: "hls",
			},
		});

		const wrapper = TestParent({
			videoUrl: "https://my.jellyfin.com/Videos/123/master.m3u8",
			videoId: "https://my.jellyfin.com::item123::key123",
			availableAudioTracks: [
				{ index: 1, label: "English", language: "eng", isDefault: true },
				{ index: 2, label: "Spanish", language: "spa" },
			],
		});

		const player = wrapper.vm.playerRef;
		await player.setAudioTrack(2);

		expect(API.post).toHaveBeenCalledWith("/room/testroom/refresh-stream", {
			service: "jellyfin",
			id: "https://my.jellyfin.com::item123::key123",
			audioStreamIndex: 2,
		});
		expect(player.getCurrentAudioTrack()).toBe(2);
		wrapper.unmount();
	});

	it("JellyfinPlayer setAudioTrack skips refresh if already on current track", async () => {
		const wrapper = TestParent({
			videoUrl: "https://my.jellyfin.com/Videos/123/master.m3u8",
			videoId: "https://my.jellyfin.com::item123::key123",
			availableAudioTracks: [
				{ index: 1, label: "English", language: "eng", isDefault: true },
			],
		});

		const player = wrapper.vm.playerRef;
		await player.setAudioTrack(1);

		expect(API.post).not.toHaveBeenCalled();
		wrapper.unmount();
	});
});
