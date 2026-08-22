import { describe, it, expect, beforeAll, beforeEach, vi, type MockInstance } from "vitest";
import JellyfinAdapter from "../../../services/jellyfin.js";
import type { AxiosRequestHeaders, AxiosResponse } from "axios";

const EPISODE_MEDIA_SOURCE_RE = /mediaSourceId=ep\d+/;

const validLinks = [
	"https://my.jellyfin.com/web/index.html#!/details?id=abc123&api_key=xyz789",
	"https://my.jellyfin.com/web/#/details?id=abc123&serverId=server1&api_key=xyz789",
	"https://jellyfin.example.com/web/index.html#!/details?id=movie123&api_key=key123",
	"https://192.168.1.100:8096/web/index.html#!/details?id=ep456&apikey=secret",
	"https://my.jellyfin.com/web/index.html#!/details?id=abc123&apiKey=camelKey",
	"https://my.jellyfin.com/web/index.html#!/details?id=abc123",
	"https://my.jellyfin.com/web/#/details?id=abc123",
	"https://my.jellyfin.com/Videos/abc123/main.m3u8?api_key=key123",
	"https://my.jellyfin.com/Videos/abc123/main.m3u8",
];

const invalidLinks = [
	"https://youtube.com/watch?v=abc",
	"https://my.jellyfin.com/some/other/path",
	"not a url",
];

describe("Jellyfin", () => {
	const adapter = new JellyfinAdapter();
	let apiGetMock: MockInstance;

	beforeAll(async () => {
		await adapter.initialize();
	});

	beforeEach(() => {
		apiGetMock = vi
			.spyOn(adapter.api, "get")
			.mockImplementation(async (url: string, _config?: unknown) => {
				const parsed = new URL(url);

				if (parsed.pathname === "/Users") {
					return mockUsersResponse([{ Id: "user123", Name: "TestUser" }]);
				}

				if (parsed.pathname.includes("/PlaybackInfo")) {
					return mockPlaybackInfoResponse([
						{
							Type: "Subtitle",
							Index: 0,
							Language: "eng",
							DisplayTitle: "English",
						},
						{
							Type: "Subtitle",
							Index: 1,
							Language: "spa",
							DisplayTitle: "Spanish",
						},
					]);
				}

				if (parsed.pathname.includes("/Shows/") && parsed.pathname.includes("/Episodes")) {
					return mockEpisodesResponse([
						{ Id: "ep001", Name: "Pilot" },
						{ Id: "ep002", Name: "Episode 2" },
					]);
				}

				if (parsed.pathname.includes("/Users/user123/Items/")) {
					const itemId = parsed.pathname.split("/").pop();
					if (itemId === "movie123") {
						return mockItemResponse({
							Id: "movie123",
							Name: "Test Movie",
							Type: "Movie",
							RunTimeTicks: 72000000000,
							Overview: "A test movie",
							Images: { Primary: "/Items/movie123/Images/Primary" },
						});
					}
					if (itemId === "series456") {
						return mockItemResponse({
							Id: "series456",
							Name: "Test Series",
							Type: "Series",
							Overview: "A test series",
						});
					}
					if (itemId === "season789") {
						return mockItemResponse({
							Id: "season789",
							Name: "Season 1",
							Type: "Season",
							ParentId: "series456",
							Overview: "Season 1",
						});
					}
					if (itemId === "ep001") {
						return mockItemResponse({
							Id: "ep001",
							Name: "Pilot",
							Type: "Episode",
							ParentIndexNumber: 1,
							IndexNumber: 1,
							SeriesName: "Test Series",
							RunTimeTicks: 27000000000,
							Overview: "First episode",
						});
					}
					if (itemId === "ep002") {
						return mockItemResponse({
							Id: "ep002",
							Name: "Episode 2",
							Type: "Episode",
							ParentIndexNumber: 1,
							IndexNumber: 2,
							SeriesName: "Test Series",
							RunTimeTicks: 27000000000,
							Overview: "Second episode",
						});
					}
				}

				throw new Error(`Unexpected URL: ${url}`);
			});
	});

	describe("canHandleURL", () => {
		it.each(validLinks)("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		it("should return true for web UI URLs", () => {
			expect(
				adapter.isCollectionURL(
					"https://my.jellyfin.com/web/index.html#!/details?id=abc123&api_key=key123",
				),
			).toEqual(true);
		});

		it("should return true for web UI hash URLs", () => {
			expect(
				adapter.isCollectionURL(
					"https://my.jellyfin.com/web/#/details?id=abc123&api_key=key123",
				),
			).toEqual(true);
		});

		it("should return false for HLS URLs", () => {
			expect(
				adapter.isCollectionURL(
					"https://my.jellyfin.com/Videos/abc123/master.m3u8?api_key=key123",
				),
			).toEqual(false);
		});

		it("should return false for Items download URLs", () => {
			expect(
				adapter.isCollectionURL(
					"https://my.jellyfin.com/Items/abc123/Download?api_key=key123",
				),
			).toEqual(false);
		});
	});

	describe("getVideoId", () => {
		it("should extract compound id from web URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract compound id from items download URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/Items/movie123/Download?api_key=key123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract compound id from URL without api_key", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract apiKey (camelCase) from query params", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&apiKey=camelKey",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract api_key from hash fragment", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/#/details?id=movie123&api_key=key123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract compound id from HLS URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/Videos/movie123/main.m3u8?api_key=key123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});
	});

	describe("fetchVideoInfo", () => {
		beforeEach(() => {
			apiGetMock.mockClear();
		});

		it("should fetch movie video info", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video).toMatchObject({
				service: "jellyfin",
				id: "https://my.jellyfin.com::movie123",
				title: "Test Movie",
				description: "A test movie",
				length: 7200,
				mime: "application/x-mpegURL",
			});
			expect(video.hls_url).toContain("master.m3u8");
			expect(video.hls_url).toContain("mediaSourceId=movie123");
		});

		it("should include subtitles when available", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.availableSubtitles).toHaveLength(2);
			expect(video.availableSubtitles?.[0]).toMatchObject({
				label: "English",
				language: "eng",
			});
			expect(video.availableSubtitles?.[1]).toMatchObject({
				label: "Spanish",
				language: "spa",
			});
			expect(video.subtitleUrl).toContain("Subtitles/0");
			expect(video.subtitleUrl).toContain("api_key=key123");
		});

		it("should select English subtitle by default", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.subtitleUrl).toContain("Subtitles/0");
			expect(video.subtitleUrl).toContain("api_key=key123");
		});

		it("should format episode title correctly", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=ep001&api_key=key123",
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.title).toEqual("Test Series - S01E01");
		});

		it("should use /Users/{userId}/Items/{itemId} for item details", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			await adapter.fetchVideoInfo(id);

			const itemCall = apiGetMock.mock.calls.find((c: unknown[]) => {
				const url = new URL(c[0] as string);
				return url.pathname.includes("/Users/user123/Items/movie123");
			});
			expect(itemCall).toBeDefined();
		});

		it("should send X-Emby-Token header", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			await adapter.fetchVideoInfo(id);

			expect(apiGetMock).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Emby-Token": "key123",
					}),
				}),
			);
		});

		it("should send X-Emby-Token header with apiKey (camelCase)", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&apiKey=camelKey",
			);
			await adapter.fetchVideoInfo(id);

			expect(apiGetMock).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Emby-Token": "camelKey",
					}),
				}),
			);
		});
	});

	describe("resolveURL", () => {
		beforeEach(() => {
			apiGetMock.mockClear();
		});

		it("should resolve single movie", async () => {
			const videos = await adapter.resolveURL(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);

			expect(videos).toHaveLength(1);
			expect(videos[0]).toMatchObject({
				service: "jellyfin",
				title: "Test Movie",
			});
		});

		it("should resolve series to multiple episodes", async () => {
			const videos = await adapter.resolveURL(
				"https://my.jellyfin.com/web/index.html#!/details?id=series456&api_key=key123",
			);

			expect(videos.length).toBeGreaterThan(1);
			videos.forEach(video => {
				expect(video).toMatchObject({
					service: "jellyfin",
				});
				expect(video.hls_url).toContain("master.m3u8");
				expect(video.hls_url).toMatch(EPISODE_MEDIA_SOURCE_RE);
			});
		});
	});
});

function mockUsersResponse(users: { Id: string; Name: string }[]): AxiosResponse {
	return {
		status: 200,
		statusText: "OK",
		data: users,
		headers: {},
		config: { headers: {} as AxiosRequestHeaders },
	};
}

function mockItemResponse(item: {
	Id: string;
	Name: string;
	Type: string;
	RunTimeTicks?: number;
	Overview?: string;
	Images?: { Primary?: string };
	ParentId?: string;
	ParentIndexNumber?: number;
	IndexNumber?: number;
	SeriesName?: string;
}): AxiosResponse {
	return {
		status: 200,
		statusText: "OK",
		data: item,
		headers: {},
		config: { headers: {} as AxiosRequestHeaders },
	};
}

function mockPlaybackInfoResponse(
	streams: {
		Type: string;
		Index: number;
		Language?: string;
		DisplayTitle?: string;
	}[],
): AxiosResponse {
	return {
		status: 200,
		statusText: "OK",
		data: {
			MediaSources: [
				{
					MediaStreams: streams,
				},
			],
		},
		headers: {},
		config: { headers: {} as AxiosRequestHeaders },
	};
}

function mockEpisodesResponse(episodes: { Id: string; Name: string }[]): AxiosResponse {
	return {
		status: 200,
		statusText: "OK",
		data: { Items: episodes },
		headers: {},
		config: { headers: {} as AxiosRequestHeaders },
	};
}
