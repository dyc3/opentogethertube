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

const mockStoreState = {
	room: { name: "testroom", isPlaying: false },
	settings: { audioBoost: 100, volume: 100, muted: false },
};

vi.mock("@/store", () => ({
	useStore: () => ({
		state: mockStoreState,
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

const mockHlsInstances: any[] = [];

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

		constructor() {
			mockHlsInstances.push(this);
		}
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

	it("JellyfinPlayer setAudioTrack ignores stale response if newer track request was initiated", async () => {
		let resolveTrack2!: (val: unknown) => void;
		const track2Promise = new Promise(resolve => {
			resolveTrack2 = resolve;
		});

		vi.mocked(API.post).mockImplementation(async (_url, body: unknown) => {
			const b = body as { audioStreamIndex: number };
			if (b.audioStreamIndex === 2) {
				await track2Promise;
				return {
					data: {
						success: true,
						// eslint-disable-next-line camelcase
						hls_url:
							"https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=2",
						playbackType: "hls",
					},
				};
			}
			return {
				data: {
					success: true,
					// eslint-disable-next-line camelcase
					hls_url: "https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=3",
					playbackType: "hls",
				},
			};
		});

		const wrapper = TestParent({
			videoUrl: "https://my.jellyfin.com/Videos/123/master.m3u8",
			videoId: "https://my.jellyfin.com::item123::key123",
			availableAudioTracks: [
				{ index: 1, label: "English", language: "eng", isDefault: true },
				{ index: 2, label: "Spanish", language: "spa" },
				{ index: 3, label: "Japanese", language: "jpn" },
			],
		});

		const player = wrapper.vm.playerRef;

		// Request track 2 (pending)
		const req2 = player.setAudioTrack(2);
		// Immediately request track 3 (completes first)
		const req3 = player.setAudioTrack(3);
		await req3;

		expect(player.getCurrentAudioTrack()).toBe(3);

		// Now let track 2 finish
		resolveTrack2(true);
		await req2;

		// Track 2 should be discarded; current track remains 3
		expect(player.getCurrentAudioTrack()).toBe(3);
		wrapper.unmount();
	});

	it("JellyfinPlayer setAudioTrack ignores response if videoId changes while request is in-flight", async () => {
		let resolveTrack2!: (val: unknown) => void;
		const track2Promise = new Promise(resolve => {
			resolveTrack2 = resolve;
		});

		vi.mocked(API.post).mockImplementation(async () => {
			await track2Promise;
			return {
				data: {
					success: true,
					// eslint-disable-next-line camelcase
					hls_url: "https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=2",
					playbackType: "hls",
				},
			};
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
		const req = player.setAudioTrack(2);

		// Video changes while request is in flight
		await wrapper.setProps({
			videoId: "https://my.jellyfin.com::item456::key456",
			videoUrl: "https://my.jellyfin.com/Videos/456/master.m3u8",
		});

		resolveTrack2(true);
		await req;

		// Should not set track 2 for the old video
		expect(player.getCurrentAudioTrack()).not.toBe(2);
		wrapper.unmount();
	});

	it("JellyfinPlayer setAudioTrack ignores response if component unmounts while in-flight", async () => {
		let resolveTrack2!: (val: unknown) => void;
		const track2Promise = new Promise(resolve => {
			resolveTrack2 = resolve;
		});

		vi.mocked(API.post).mockImplementation(async () => {
			await track2Promise;
			return {
				data: {
					success: true,
					// eslint-disable-next-line camelcase
					hls_url: "https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=2",
					playbackType: "hls",
				},
			};
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
		const req = player.setAudioTrack(2);

		wrapper.unmount();
		resolveTrack2(true);
		await req;
	});

	it("JellyfinPlayer setAudioTrack invalidates in-flight request when user returns to current track", async () => {
		let resolveTrack2!: (val: unknown) => void;
		const track2Promise = new Promise(resolve => {
			resolveTrack2 = resolve;
		});

		vi.mocked(API.post).mockImplementation(async () => {
			await track2Promise;
			return {
				data: {
					success: true,
					// eslint-disable-next-line camelcase
					hls_url: "https://my.jellyfin.com/Videos/123/master.m3u8?AudioStreamIndex=2",
					playbackType: "hls",
				},
			};
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

		// Track 1 is current. Request track 2 (in-flight)
		const req2 = player.setAudioTrack(2);

		// User immediately re-selects track 1 (active track)
		const req1 = player.setAudioTrack(1);
		await req1;

		expect(player.getCurrentAudioTrack()).toBe(1);

		// Now let track 2 resolve
		resolveTrack2(true);
		await req2;

		// In-flight request for track 2 should have been invalidated by selecting track 1
		expect(player.getCurrentAudioTrack()).toBe(1);
		wrapper.unmount();
	});

	it("JellyfinPlayer resumes playback on MANIFEST_PARSED when room isPlaying is true", async () => {
		mockStoreState.room.isPlaying = true;
		const playSpy = vi
			.spyOn(HTMLMediaElement.prototype, "play")
			.mockResolvedValue(undefined as any);

		const wrapper = TestParent({
			videoUrl: "https://my.jellyfin.com/Videos/123/master.m3u8",
			videoId: "https://my.jellyfin.com::item123::key123",
			availableAudioTracks: [],
		});

		const hlsInstance = mockHlsInstances[mockHlsInstances.length - 1];
		const manifestParsedCall = hlsInstance.on.mock.calls.find(
			(c: any[]) => c[0] === "hlsManifestParsed",
		);
		expect(manifestParsedCall).toBeDefined();

		// Trigger MANIFEST_PARSED
		manifestParsedCall[1]();

		expect(playSpy).toHaveBeenCalled();

		playSpy.mockRestore();
		mockStoreState.room.isPlaying = false;
		wrapper.unmount();
	});
});
