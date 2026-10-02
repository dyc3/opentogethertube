import { describe, it, expect, beforeAll, beforeEach, vi, type MockInstance } from "vitest";
import JellyfinAdapter from "../../../services/jellyfin.js";
import type { AxiosRequestHeaders, AxiosResponse } from "axios";
import { BadApiArgumentException, JellyfinApiKeyException } from "../../../exceptions.js";
import { buildClients, redisClient } from "../../../redisclient.js";

const EPISODE_MEDIA_SOURCE_RE = /\/Videos\/ep\d+\/master\.m3u8/;
const PLAYBACK_INFO_ITEM_ID_REGEX = /\/Items\/([^/]+)\/PlaybackInfo/;
const MISSING_API_KEY_REGEX = /Missing API key/;
const UNAUTHORIZED_REGEX = /Unauthorized/;
const OPAQUE_TOKEN_ID_REGEX = /^https:\/\/my\.jellyfin\.com::movie123::[0-9a-f-]{36}$/;
const OPAQUE_TOKEN_SUBPATH_JELLYFIN_REGEX =
	/^https:\/\/my\.jellyfin\.com\/jellyfin::movie123::[0-9a-f-]{36}$/;
const OPAQUE_TOKEN_SUBPATH_JF_REGEX = /^https:\/\/my\.jellyfin\.com\/jf::movie123::[0-9a-f-]{36}$/;
const OPAQUE_TOKEN_SUBPATH_MEDIA_REGEX =
	/^https:\/\/my\.jellyfin\.com\/media::movie123::[0-9a-f-]{36}$/;

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
	let apiPostMock: MockInstance;

	beforeAll(async () => {
		try {
			await buildClients();
		} catch {
			// ignore
		}
		await adapter.initialize();
	});

	beforeEach(() => {
		vi.restoreAllMocks();
		(adapter as any).apiKeyCache?.clear();
		(adapter as any).userIdCache?.clear();
		apiGetMock = vi.spyOn(adapter.api, "get") as MockInstance;
		apiPostMock = vi.spyOn(adapter.api, "post") as MockInstance;
		installDefaultMock();
	});

	function installDefaultMock(): void {
		apiGetMock.mockReset();
		apiPostMock.mockReset();
		apiPostMock.mockImplementation(async (url: string, _body?: unknown) => {
			const parsed = new URL(url);
			if (parsed.pathname.includes("/PlaybackInfo")) {
				const match = parsed.pathname.match(PLAYBACK_INFO_ITEM_ID_REGEX);
				const itemId = match ? match[1] : "movie123";
				return mockPlaybackInfoResponse(
					[
						{
							Type: "Subtitle",
							Index: 0,
							Codec: "subrip",
							Language: "eng",
							DisplayTitle: "English",
							IsTextSubtitleStream: true,
							SupportsExternalStream: true,
						},
						{
							Type: "Subtitle",
							Index: 1,
							Codec: "subrip",
							Language: "spa",
							DisplayTitle: "Spanish",
							IsTextSubtitleStream: true,
							SupportsExternalStream: true,
						},
					],
					{
						Id: itemId,
						TranscodingUrl: `/Videos/${itemId}/master.m3u8?MediaSourceId=${itemId}&VideoCodec=h264&AudioCodec=aac&PlaySessionId=session123`,
					},
				);
			}
			throw new Error(`Unexpected POST URL: ${url}`);
		});
		apiGetMock.mockImplementation(async (url: string, _config?: unknown) => {
			const parsed = new URL(url);

			if (parsed.pathname.endsWith("/Users")) {
				return mockUsersResponse([{ Id: "user123", Name: "TestUser" }]);
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
						ImageTags: { Primary: "tag123" },
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
	}

	function mockApiWithPlayback(
		streams: {
			Type: string;
			Index: number;
			Codec?: string;
			Language?: string;
			Title?: string;
			DisplayTitle?: string;
			IsDefault?: boolean;
			IsTextSubtitleStream?: boolean;
			SupportsExternalStream?: boolean;
			DeliveryUrl?: string;
		}[],
		mediaSource?: {
			Id?: string;
			TranscodingUrl?: string;
		},
	): void {
		apiPostMock.mockReset();
		apiPostMock.mockImplementation(async (url: string) => {
			const parsed = new URL(url);
			if (parsed.pathname.includes("/PlaybackInfo")) {
				return mockPlaybackInfoResponse(streams, mediaSource);
			}
			throw new Error(`Unexpected POST URL: ${url}`);
		});
	}

	describe("canHandleURL", () => {
		it.each(validLinks)("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});

		it("should reject local/loopback and link-local destinations", () => {
			expect(
				adapter.canHandleURL(
					"http://127.0.0.1:8096/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(false);
			expect(
				adapter.canHandleURL(
					"http://localhost:8096/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(false);
			expect(
				adapter.canHandleURL(
					"http://[::1]:8096/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(false);
			expect(
				adapter.canHandleURL(
					"http://169.254.169.254/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(false);
		});

		it("should enforce allowlist if configured", () => {
			adapter.setAllowedHosts(["allowed.jellyfin.com"]);
			expect(
				adapter.canHandleURL(
					"https://allowed.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(true);
			expect(
				adapter.canHandleURL(
					"https://disallowed.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toBe(false);
			adapter.setAllowedHosts([]);
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
		it("should extract compound id with opaque token from web URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_ID_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from items download URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/Items/movie123/Download?api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_ID_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from URL without api_key", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123",
			);
			expect(id).toEqual("https://my.jellyfin.com::movie123");
		});

		it("should extract apiKey (camelCase) from query params without leaking in id", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&apiKey=camelKey",
			);
			expect(id).toMatch(OPAQUE_TOKEN_ID_REGEX);
			expect(id).not.toContain("camelKey");
		});

		it("should extract api_key from hash fragment without leaking in id", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/#/details?id=movie123&api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_ID_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from HLS URL", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/Videos/movie123/main.m3u8?api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_ID_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from web URL with subpath", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/jellyfin/web/index.html#!/details?id=movie123&api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_SUBPATH_JELLYFIN_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from items download URL with subpath", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/jf/Items/movie123/Download?api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_SUBPATH_JF_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should extract compound id from HLS URL with subpath", () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/media/Videos/movie123/main.m3u8?api_key=key123",
			);
			expect(id).toMatch(OPAQUE_TOKEN_SUBPATH_MEDIA_REGEX);
			expect(id).not.toContain("key123");
		});

		it("should throw BadApiArgumentException for disallowed hosts in getVideoId", () => {
			adapter.setAllowedHosts(["allowed.jellyfin.com"]);
			expect(() =>
				adapter.getVideoId(
					"https://disallowed.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toThrow(BadApiArgumentException);
			adapter.setAllowedHosts([]);
		});

		it("should throw BadApiArgumentException for local/loopback hosts in getVideoId", () => {
			expect(() =>
				adapter.getVideoId(
					"http://127.0.0.1:8096/web/index.html#!/details?id=movie123&api_key=key123",
				),
			).toThrow(BadApiArgumentException);
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
				id,
				title: "Test Movie",
				description: "A test movie",
				length: 7200,
				mime: "application/x-mpegURL",
			});
			expect(video.hls_url).toContain("/Videos/movie123/master.m3u8");
			expect(video.hls_url).toContain("PlaySessionId=session123");
			expect(video.hls_url).toContain("api_key=key123");
			expect(video.src_url).toBeUndefined();
			expect(video.thumbnail).toBe("https://my.jellyfin.com/Items/movie123/Images/Primary");
			expect(video.thumbnail).not.toContain("api_key");
			expect(video.thumbnail).not.toContain("apiKey");
		});

		it("should prefer user from GET /Users/Me when available", async () => {
			apiGetMock.mockImplementation(async (url: string) => {
				const parsed = new URL(url);
				if (parsed.pathname === "/Users/Me") {
					return {
						status: 200,
						statusText: "OK",
						data: { Id: "userMe456", Name: "MeUser" },
						headers: {},
						config: { headers: {} as AxiosRequestHeaders },
					};
				}
				if (parsed.pathname.endsWith("/Users")) {
					return mockUsersResponse([{ Id: "userFallback123", Name: "FallbackUser" }]);
				}
				if (parsed.pathname.includes("/Users/userMe456/Items/movie123")) {
					return mockItemResponse({
						Id: "movie123",
						Name: "Test Movie",
						Type: "Movie",
						RunTimeTicks: 72000000000,
					});
				}
				throw new Error(`Unexpected GET URL: ${url}`);
			});

			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=userToken123",
			);
			await adapter.fetchVideoInfo(id);

			expect(apiPostMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/Items/movie123/PlaybackInfo?userId=userMe456",
				expect.anything(),
				expect.anything(),
			);
		});

		it("should post a minimal playback info body", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			await adapter.fetchVideoInfo(id);

			expect(apiPostMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/Items/movie123/PlaybackInfo?userId=user123",
				expect.objectContaining({
					StartTimeTicks: 0,
					IsPlayback: true,
					AutoOpenLiveStream: true,
					AlwaysBurnInSubtitleWhenTranscoding: false,
					DeviceProfile: expect.objectContaining({
						Name: "OpenTogetherTube",
					}),
				}),
				expect.objectContaining({
					headers: expect.objectContaining({ "X-Emby-Token": "key123" }),
				}),
			);
		});

		it("should use the transcoding url for playback", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback([], {
				Id: "movie123",
				TranscodingUrl: "/Videos/movie123/master.m3u8?PlaySessionId=transcode1",
			});
			const video = await adapter.fetchVideoInfo(id);

			expect(video.hls_url).toContain("PlaySessionId=transcode1");
			expect(video.src_url).toBeUndefined();
			expect(video.mime).toEqual("application/x-mpegURL");
		});

		it("should keep working after a restart drops the in-memory key cache via redis", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			// Simulate a server restart wiping the in-memory caches, recovered via Redis
			(
				adapter as unknown as {
					apiKeyCache: Map<string, string>;
					userIdCache: Map<string, string>;
				}
			).apiKeyCache.clear();
			const redisSpy = vi.spyOn(redisClient, "get").mockResolvedValue("key123");
			const video = await adapter.fetchVideoInfo(id);

			expect(video.hls_url).toContain("/Videos/movie123/master.m3u8");
			expect(video.hls_url).toContain("api_key=key123");
			redisSpy.mockRestore();
		});

		it("should fail with a clear error when no api key is available", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123",
			);
			await expect(adapter.fetchVideoInfo(id)).rejects.toThrow(MISSING_API_KEY_REGEX);
		});

		it("should fail with a clear error on 401 from playback info", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			apiPostMock.mockReset();
			apiPostMock.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
			await expect(adapter.fetchVideoInfo(id)).rejects.toThrow(UNAUTHORIZED_REGEX);
		});

		it("should throw the key error when a bulk fetch fully fails on credentials", async () => {
			await expect(
				adapter.fetchManyVideoInfo([
					{ id: "https://my.jellyfin.com::movie123", missingInfo: [] },
					{ id: "https://my.jellyfin.com::ep001", missingInfo: [] },
				]),
			).rejects.toThrow(MISSING_API_KEY_REGEX);
		});

		it("should return partial results when only some bulk videos lack credentials", async () => {
			const videos = await adapter.fetchManyVideoInfo([
				{
					id: "https://my.jellyfin.com::movie123::key123",
					missingInfo: [],
				},
				{ id: "https://my.jellyfin.com::ep001", missingInfo: [] },
			]);

			expect(videos).toHaveLength(1);
			expect(videos[0].title).toEqual("Test Movie");
		});

		it("should fall back to the hardcoded hls url when no usable url is present", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback([], { Id: "movie123" });
			const video = await adapter.fetchVideoInfo(id);

			expect(video.hls_url).toContain("/Videos/movie123/master.m3u8");
			expect(video.hls_url).toContain("AudioCodec=aac");
			expect(video.hls_url).toContain("MediaSourceId=movie123");
			expect(video.hls_url).toContain("PlaySessionId=");
			expect(video.hls_url).toContain("api_key=key123");
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

		it("should use the media source id in subtitle urls", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback(
				[
					{
						Type: "Subtitle",
						Index: 2,
						Codec: "subrip",
						Language: "eng",
						DisplayTitle: "English",
						IsTextSubtitleStream: true,
						SupportsExternalStream: true,
					},
				],
				{ Id: "mediasource999" },
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.subtitleUrl).toContain("/Videos/movie123/mediasource999/Subtitles/2/0/");
			expect(video.hls_url).toContain("/Videos/movie123/master.m3u8");
			expect(video.hls_url).toContain("AudioCodec=aac");
			expect(video.hls_url).toContain("MediaSourceId=mediasource999");
			expect(video.hls_url).toContain("PlaySessionId=");
		});

		it("should filter out subtitles that cannot be delivered externally", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback(
				[
					{
						Type: "Subtitle",
						Index: 2,
						Codec: "subrip",
						Language: "eng",
						DisplayTitle: "English",
						IsTextSubtitleStream: true,
						SupportsExternalStream: true,
					},
					{
						Type: "Subtitle",
						Index: 3,
						Codec: "pgssub",
						Language: "eng",
						DisplayTitle: "English PGS",
						IsTextSubtitleStream: false,
						SupportsExternalStream: false,
					},
					{
						Type: "Subtitle",
						Index: 4,
						Codec: "dvbsub",
						Language: "spa",
						DisplayTitle: "Spanish DVB",
						IsTextSubtitleStream: false,
						SupportsExternalStream: true,
					},
					{
						Type: "Audio",
						Index: 1,
					},
				],
				{ Id: "movie123" },
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.availableSubtitles).toHaveLength(1);
			expect(video.availableSubtitles?.[0]).toMatchObject({
				label: "English",
				language: "eng",
			});
		});

		it("should prefer the server-provided delivery url when present", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback(
				[
					{
						Type: "Subtitle",
						Index: 2,
						Codec: "subrip",
						Language: "eng",
						DisplayTitle: "English",
						IsTextSubtitleStream: true,
						SupportsExternalStream: true,
						DeliveryUrl: "/Videos/movie123/movie123/Subtitles/2/0/Stream.vtt",
					},
				],
				{ Id: "movie123" },
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.subtitleUrl).toContain(
				"/Videos/movie123/movie123/Subtitles/2/0/Stream.vtt",
			);
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

		it("should extract multi-track audio and include availableAudioTracks", async () => {
			const id = adapter.getVideoId(
				"https://my.jellyfin.com/web/index.html#!/details?id=movie123&api_key=key123",
			);
			mockApiWithPlayback(
				[
					{
						Type: "Video",
						Index: 0,
					},
					{
						Type: "Audio",
						Index: 1,
						Codec: "aac",
						Language: "eng",
						DisplayTitle: "English (AAC 5.1)",
						IsDefault: true,
					},
					{
						Type: "Audio",
						Index: 2,
						Codec: "flac",
						Language: "jpn",
						DisplayTitle: "Japanese (FLAC Stereo)",
					},
					{
						Type: "Audio",
						Index: 3,
						Codec: "aac",
						Language: "und",
						Title: "Commentary",
					},
					{
						Type: "Subtitle",
						Index: 4,
						Codec: "subrip",
						Language: "eng",
						DisplayTitle: "English",
						IsTextSubtitleStream: true,
						SupportsExternalStream: true,
					},
				],
				{ Id: "movie123" },
			);
			const video = await adapter.fetchVideoInfo(id);

			expect(video.availableAudioTracks).toHaveLength(3);
			expect(video.availableAudioTracks).toEqual([
				{
					index: 1,
					label: "English (AAC 5.1)",
					language: "eng",
					codec: "aac",
					isDefault: true,
				},
				{
					index: 2,
					label: "Japanese (FLAC Stereo)",
					language: "jpn",
					codec: "flac",
					isDefault: undefined,
				},
				{
					index: 3,
					label: "Commentary",
					language: "und",
					codec: "aac",
					isDefault: undefined,
				},
			]);
		});

		it("should preserve subpath in API requests and stream URLs", async () => {
			const id = "https://my.jellyfin.com/jellyfin::movie123::key123";
			const video = await adapter.fetchVideoInfo(id);

			expect(apiGetMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/jellyfin/Users",
				expect.any(Object),
			);
			expect(apiGetMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/jellyfin/Users/user123/Items/movie123",
				expect.any(Object),
			);
			expect(apiPostMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/jellyfin/Items/movie123/PlaybackInfo?userId=user123",
				expect.any(Object),
				expect.any(Object),
			);
			expect(video.hls_url).toContain(
				"https://my.jellyfin.com/jellyfin/Videos/movie123/master.m3u8",
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
				expect(video.hls_url).toContain("PlaySessionId=session123");
				expect(video.hls_url).toMatch(EPISODE_MEDIA_SOURCE_RE);
			});
		});
	});

	describe("getRefreshedStream", () => {
		it("should request playback info with audioStreamIndex and return transcoding URL", async () => {
			const res = await adapter.getRefreshedStream(
				"https://my.jellyfin.com::movie123::key123",
				2,
			);

			expect(apiPostMock).toHaveBeenCalledWith(
				"https://my.jellyfin.com/Items/movie123/PlaybackInfo?userId=user123",
				expect.objectContaining({
					AudioStreamIndex: 2,
					MediaSourceId: "movie123",
				}),
				expect.any(Object),
			);
			expect(res.playbackType).toBe("hls");
			expect(res.hls_url).toContain("https://my.jellyfin.com");
			expect(res.hls_url).toContain("master.m3u8");
			expect(res.hls_url).toContain("api_key=key123");
		});

		it("should fallback to constructStreamUrl if TranscodingUrl is absent", async () => {
			mockApiWithPlayback(
				[
					{
						Type: "Audio",
						Index: 1,
						Codec: "aac",
						Language: "eng",
					},
				],
				{
					Id: "ms456",
				},
			);

			const res = await adapter.getRefreshedStream(
				"https://my.jellyfin.com::movie123::key123",
				1,
			);

			expect(res.playbackType).toBe("hls");
			expect(res.hls_url).toContain("/Videos/movie123/master.m3u8");
			expect(res.hls_url).toContain("api_key=key123");
			expect(res.hls_url).toContain("AudioCodec=aac");
			expect(res.hls_url).toContain("AudioStreamIndex=1");
			expect(res.hls_url).toContain("MediaSourceId=ms456");
			expect(res.hls_url).toContain("PlaySessionId=");
		});

		it("should throw BadApiArgumentException on invalid audioStreamIndex", async () => {
			await expect(
				adapter.getRefreshedStream("https://my.jellyfin.com::movie123::key123", -1),
			).rejects.toThrow(BadApiArgumentException);

			await expect(
				adapter.getRefreshedStream("https://my.jellyfin.com::movie123::key123", 1.5),
			).rejects.toThrow(BadApiArgumentException);
		});

		it("should throw JellyfinApiKeyException when API key is missing", async () => {
			await expect(
				adapter.getRefreshedStream("https://my.jellyfin.com::movie123"),
			).rejects.toThrow(JellyfinApiKeyException);
		});

		it("should throw JellyfinApiKeyException on 401 Unauthorized", async () => {
			apiPostMock.mockRejectedValueOnce({
				isAxiosError: true,
				response: { status: 401 },
			});

			await expect(
				adapter.getRefreshedStream("https://my.jellyfin.com::movie123::invalidKey", 0),
			).rejects.toThrow(JellyfinApiKeyException);
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
	ImageTags?: { Primary?: string };
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
		Codec?: string;
		Language?: string;
		Title?: string;
		DisplayTitle?: string;
		IsDefault?: boolean;
		IsTextSubtitleStream?: boolean;
		SupportsExternalStream?: boolean;
		DeliveryUrl?: string;
	}[],
	mediaSource?: {
		Id?: string;
		TranscodingUrl?: string;
	},
): AxiosResponse {
	return {
		status: 200,
		statusText: "OK",
		data: {
			MediaSources: [
				{
					Id: mediaSource?.Id,
					TranscodingUrl: mediaSource?.TranscodingUrl,
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
