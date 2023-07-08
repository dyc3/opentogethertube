import YouTubeAdapter, {
	YoutubeErrorResponse,
	YoutubeApiVideoListResponse,
	YoutubeApiVideo,
} from "../../../services/youtube";
import { Video } from "../../../../common/models/video";
import { InvalidVideoIdException, OutOfQuotaException } from "../../../exceptions";
import { buildClients, redisClient, redisClientAsync } from "../../../redisclient";
import { AxiosError, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from "axios";
import fs from "fs";
import { VideoRequest } from "server/serviceadapter";
import { URL } from "url";
import { loadModels } from "../../../models";

const validVideoLinks = [
	["3kw2_89ym31W", "https://youtube.com/watch?v=3kw2_89ym31W"],
	["3kw2_89ym31W", "https://www.youtube.com/watch?v=3kw2_89ym31W"],
	["3kw2_89ym31W", "https://youtu.be/3kw2_89ym31W"],
	["R5i-cktCTb4", "https://youtube.com/shorts/R5i-cktCTb4?feature=share"],
	["DMfu0KiqWnk", "https://studio.youtube.com/video/DMfu0KiqWnk/edit"],
];

const invalidLinks = [
	"https://example.com",
	"https://youtube.com",
	"https://youtube.com/lkjsads",
	"https://youtu.be",
	"https://www.youtube.com/c/",
	"https://www.youtube.com/channel/",
	"https://www.youtube.com/watch",
	"https://www.youtube.com/playlist",
	"https://youtube.com/@",
];

const validCollectionLinks = [
	"https://www.youtube.com/c/ChannelName",
	"https://www.youtube.com/channel/981g-23981g23981g298",
	"https://www.youtube.com/playlist?list=0a8shd08ahsdoih12--9as8hd",
	"https://www.youtube.com/watch?v=0hasodi12&list=9asdouihlj1293gashd",
	"https://youtu.be/3kw2_89ym31W?list=PL4d83g68ij3l45kj6345hFaEHvzLovtb",
	"https://youtube.com/@handle",
];

const FIXTURE_DIRECTORY = "./tests/unit/fixtures/services/youtube";

function mockVideoList(ids: string[]): YoutubeApiVideoListResponse {
	// TODO: filter out parts that are not specified in the parts parameter
	return {
		kind: "youtube#videoListResponse",
		etag: `not real etag: ${ids.join(",")}`,
		nextPageToken: "next",
		prevPageToken: "prev",
		pageInfo: {
			totalResults: ids.length,
			resultsPerPage: ids.length,
		},
		items: ids.map(
			id =>
				JSON.parse(
					fs.readFileSync(`${FIXTURE_DIRECTORY}/${id}.json`, "utf8")
				) as YoutubeApiVideo
		),
	};
}

function mockPlaylistItems(id: string): unknown {
	let path = `${FIXTURE_DIRECTORY}/playlistItems/${id}.json`;
	if (fs.existsSync(path)) {
		let content = fs.readFileSync(path, "utf8");
		return JSON.parse(content);
	}
	throw new Error("playlistNotFound");
}

function mockChannel(id: string): unknown {
	let path = `${FIXTURE_DIRECTORY}/channels/${id}.json`;
	if (!fs.existsSync(path)) {
		path = `${FIXTURE_DIRECTORY}/channels/empty.json`;
	}
	let content = fs.readFileSync(path, "utf8");
	return JSON.parse(content);
}

async function mockYoutubeApi(
	path: string,
	config?: AxiosRequestConfig
): Promise<AxiosResponse<any>> {
	const template = {
		status: 200,
		statusText: "OK",
		headers: {},
		config: {
			headers: {} as AxiosRequestHeaders,
		},
	};
	if (path === "/videos") {
		return {
			...template,
			data: mockVideoList(config?.params.id.split(",")),
		};
	} else if (path === "/playlistItems") {
		try {
			return {
				...template,
				data: mockPlaylistItems(config?.params.playlistId),
			};
		} catch (e) {
			let content = fs.readFileSync(`${FIXTURE_DIRECTORY}/errors/${e.message}.json`, "utf8");
			return JSON.parse(content);
		}
	} else if (path === "/channels") {
		return {
			...template,
			data: mockChannel(config?.params.id ?? config?.params.forUsername),
		};
	}
	throw new Error(`unexpected path: ${path}`);
}

describe("Youtube", () => {
	let adapter: YouTubeAdapter;
	beforeAll(() => {
		loadModels();
		buildClients();
		adapter = new YouTubeAdapter("", redisClient, redisClientAsync);
	});

	describe("canHandleURL", () => {
		it.each(validVideoLinks.map(l => l[1]).concat(validCollectionLinks))("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		it.each(validVideoLinks.map(l => l[1]))("Returns false for %s", link => {
			expect(adapter.isCollectionURL(link)).toBe(false);
		});

		it.each(validCollectionLinks)("Returns true for %s", link => {
			expect(adapter.isCollectionURL(link)).toBe(true);
		});
	});

	describe("getVideoId", () => {
		it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
			expect(adapter.getVideoId(link)).toBe(id);
		});
	});

	describe("fetchVideoInfo", () => {
		let apiGet: jest.SpyInstance;
		const videoId = "BTZ5KVRUy1Q";

		beforeAll(() => {
			apiGet = jest.spyOn(adapter.api, "get").mockImplementation(mockYoutubeApi);
		});

		beforeEach(() => {
			apiGet.mockClear();
		});

		it("Returns a promise", () => {
			expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
		});

		it("Queries the YouTube API", async () => {
			await adapter.fetchVideoInfo(videoId);
			expect(apiGet).toBeCalled();
		});

		it("Throws an error if videoId is invalid", () => {
			return expect(adapter.fetchVideoInfo("")).rejects.toThrowError(InvalidVideoIdException);
		});
	});

	describe("fetchManyVideoInfo", () => {
		let apiGet: jest.SpyInstance;

		beforeAll(() => {
			apiGet = jest.spyOn(adapter.api, "get").mockImplementation(mockYoutubeApi);
		});

		beforeEach(() => {
			apiGet.mockClear();
		});

		it("Should return result same length as input, as long as all video types are supported", async () => {
			const requests: VideoRequest[] = [
				{
					id: "BTZ5KVRUy1Q",
					missingInfo: ["title"],
				},
				{
					id: "I3O9J02G67I",
					missingInfo: ["length"],
				},
			];
			let result = await adapter.fetchManyVideoInfo(requests);
			expect(result).toHaveLength(requests.length);
		});

		it("Should make 2 api requests to get different metadata", async () => {
			const requests: VideoRequest[] = [
				{
					id: "BTZ5KVRUy1Q",
					missingInfo: ["title"],
				},
				{
					id: "zgxj_0xPleg",
					missingInfo: ["title"],
				},
				{
					id: "I3O9J02G67I",
					missingInfo: ["length"],
				},
			];
			await adapter.fetchManyVideoInfo(requests);
			expect(adapter.api.get).toHaveBeenCalledTimes(2);
		});
	});

	describe("resolveURL", () => {
		let apiGet: jest.SpyInstance;

		beforeAll(() => {
			apiGet = jest.spyOn(adapter.api, "get").mockImplementation(mockYoutubeApi);
		});

		beforeEach(() => {
			apiGet.mockClear();
		});

		it.each(
			[
				"https://youtube.com/watch?v=%s",
				"https://youtu.be/%s",
				"https://youtube.com/shorts/%s",
			].map(x => x.replace("%s", "BTZ5KVRUy1Q"))
		)("Resolves single video URL: %s", async link => {
			const videos = await adapter.resolveURL(link);
			expect(videos).toHaveLength(1);
			expect(videos[0]).toEqual({
				service: "youtube",
				id: "BTZ5KVRUy1Q",
				title: "tmpIwT4T4",
				description: "tmpIwT4T4",
				thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
				length: 10,
			});
			expect(apiGet).toHaveBeenCalledTimes(1);
		});

		it.each(
			["https://youtube.com/watch?v=%s&list=%p", "https://youtu.be/%s?list=%p"].map(x =>
				x.replace("%s", "zgxj_0xPleg").replace("%p", "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")
			)
		)("Resolves single video URL with playlist, with video in the playlist: %s", async link => {
			const fetchSpy = jest.spyOn(adapter, "fetchVideoWithPlaylist");
			const fetchVideo = jest.spyOn(adapter, "fetchVideoInfo");
			const fetchPlaylist = jest.spyOn(adapter, "fetchPlaylistVideos");

			const videos = await adapter.resolveURL(link);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(fetchPlaylist).toHaveBeenCalledTimes(1);
			expect(fetchVideo).toHaveBeenCalledTimes(0);
			expect(videos).toEqual([
				{
					service: "youtube",
					id: "zgxj_0xPleg",
					title: "Chris Chan: A Comprehensive History - Part 1",
					description: "(1982-2000)",
					thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
					// length expected to be undefined because the youtube api doesn't return video length in playlist items
					// feature requested here: https://issuetracker.google.com/issues/173420445
					highlight: true,
				},
				{
					service: "youtube",
					id: "_3QMqssyBwQ",
					title: "Chris Chan: A Comprehensive History - Part 2",
					description: "(2000-2004)",
					thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
				},
			]);
			expect(apiGet).toHaveBeenCalledTimes(1);

			fetchSpy.mockRestore();
			fetchVideo.mockRestore();
			fetchPlaylist.mockRestore();
		});

		it.each(
			["https://youtube.com/watch?v=%s&list=%p", "https://youtu.be/%s?list=%p"].map(x =>
				x.replace("%s", "BTZ5KVRUy1Q").replace("%p", "PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm")
			)
		)(
			"Resolves single video URL with playlist, with video NOT in the playlist: %s",
			async link => {
				const fetchSpy = jest.spyOn(adapter, "fetchVideoWithPlaylist");
				const fetchVideo = jest.spyOn(adapter, "fetchVideoInfo");
				const fetchPlaylist = jest.spyOn(adapter, "fetchPlaylistVideos");

				const videos = await adapter.resolveURL(link);
				expect(fetchSpy).toHaveBeenCalledTimes(1);
				expect(fetchPlaylist).toHaveBeenCalledTimes(1);
				expect(fetchVideo).toHaveBeenCalledTimes(1);
				expect(videos).toEqual([
					{
						service: "youtube",
						id: "BTZ5KVRUy1Q",
						title: "tmpIwT4T4",
						description: "tmpIwT4T4",
						thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
						length: 10,
						highlight: true,
					},
					{
						service: "youtube",
						id: "zgxj_0xPleg",
						title: "Chris Chan: A Comprehensive History - Part 1",
						description: "(1982-2000)",
						thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
						// length expected to be undefined because the youtube api doesn't return video length in playlist items
						// feature requested here: https://issuetracker.google.com/issues/173420445
					},
					{
						service: "youtube",
						id: "_3QMqssyBwQ",
						title: "Chris Chan: A Comprehensive History - Part 2",
						description: "(2000-2004)",
						thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
					},
				]);
				expect(apiGet).toHaveBeenCalledTimes(2);

				fetchSpy.mockRestore();
				fetchVideo.mockRestore();
				fetchPlaylist.mockRestore();
			}
		);

		it("Recovers after not being able to fetch playlist information for a video", async () => {
			const link = "https://youtube.com/watch?v=BTZ5KVRUy1Q&list=fakelistid";
			const videos = await adapter.resolveURL(link);
			expect(videos).toHaveLength(1);
			expect(videos[0]).toEqual({
				service: "youtube",
				id: "BTZ5KVRUy1Q",
				title: "tmpIwT4T4",
				description: "tmpIwT4T4",
				thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
				length: 10,
			});
		});

		it.each(["LL", "WL"].map(p => `https://youtube.com/watch?v=BTZ5KVRUy1Q&list=${p}`))(
			"Ignores the WL and LL private playlists",
			async link => {
				const fetchVideoWithPlaylist = jest.spyOn(adapter, "fetchVideoWithPlaylist");
				const fetchVideo = jest.spyOn(adapter, "fetchVideoInfo");
				const videos: Video[] = await adapter.resolveURL(link);
				expect(videos).toHaveLength(1);
				expect(videos[0]).toEqual({
					service: "youtube",
					id: "BTZ5KVRUy1Q",
					title: "tmpIwT4T4",
					description: "tmpIwT4T4",
					thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/mqdefault.jpg",
					length: 10,
				});
				expect(fetchVideo).toBeCalledTimes(1);
				expect(fetchVideoWithPlaylist).not.toBeCalled();

				fetchVideoWithPlaylist.mockRestore();
				fetchVideo.mockRestore();
			}
		);

		it("Resolves playlist", async () => {
			const fetchVideoWithPlaylist = jest.spyOn(adapter, "fetchVideoWithPlaylist");
			const fetchVideo = jest.spyOn(adapter, "fetchVideoInfo");
			const fetchPlaylist = jest.spyOn(adapter, "fetchPlaylistVideos");

			const videos = await adapter.resolveURL(
				"https://youtube.com/playlist?list=PLABqEYq6H3vpCmsmyUnHnfMOeAnjBdSNm"
			);
			expect(fetchVideoWithPlaylist).toHaveBeenCalledTimes(0);
			expect(fetchPlaylist).toHaveBeenCalledTimes(1);
			expect(fetchVideo).toHaveBeenCalledTimes(0);
			expect(videos).toEqual([
				{
					service: "youtube",
					id: "zgxj_0xPleg",
					title: "Chris Chan: A Comprehensive History - Part 1",
					description: "(1982-2000)",
					thumbnail: "https://i.ytimg.com/vi/zgxj_0xPleg/mqdefault.jpg",
					// length expected to be undefined because the youtube api doesn't return video length in playlist items
					// feature requested here: https://issuetracker.google.com/issues/173420445
				},
				{
					service: "youtube",
					id: "_3QMqssyBwQ",
					title: "Chris Chan: A Comprehensive History - Part 2",
					description: "(2000-2004)",
					thumbnail: "https://i.ytimg.com/vi/_3QMqssyBwQ/default.jpg",
				},
			]);
			expect(apiGet).toHaveBeenCalledTimes(1);

			fetchVideoWithPlaylist.mockRestore();
			fetchVideo.mockRestore();
			fetchPlaylist.mockRestore();
		});

		it("Resolves channel URLs", async () => {
			const channelId = "UCL7DDQWP6x7wy0O6L5ZIgxg";
			const channelURL = `https://www.youtube.com/channel/${channelId}`;

			await adapter.resolveURL(channelURL);
			expect(apiGet).toHaveBeenCalledTimes(2);
			expect(apiGet).toHaveBeenNthCalledWith(1, "/channels", {
				params: expect.objectContaining({ id: channelId }),
			});
			expect(apiGet).toHaveBeenNthCalledWith(2, "/playlistItems", {
				params: expect.objectContaining({
					playlistId: "UUL7DDQWP6x7wy0O6L5ZIgxg",
				}),
			});
		});

		it("Resolves legacy user URLs", async () => {
			const userName = "vinesauce";
			const channelURL = `https://www.youtube.com/user/${userName}`;

			await adapter.resolveURL(channelURL);
			expect(apiGet).toHaveBeenCalledTimes(2);
			expect(apiGet).toHaveBeenNthCalledWith(1, "/channels", {
				params: expect.objectContaining({ forUsername: userName }),
			});
			expect(apiGet).toHaveBeenNthCalledWith(2, "/playlistItems", {
				params: expect.objectContaining({
					playlistId: "UUzORJV8l3FWY4cFO8ot-F2w",
				}),
			});
		});
	});

	describe("searchVideos", () => {
		const adapter = new YouTubeAdapter("", redisClient, redisClientAsync);
		const apiGet = jest.spyOn(adapter.api, "get");

		beforeEach(() => {
			apiGet.mockClear();
		});

		it("Queries the YouTube API for videos", async () => {
			apiGet.mockResolvedValue({ data: { items: [] } });
			const searchQuery = "Testing";

			await adapter.searchVideos(searchQuery);

			expect(apiGet).toHaveBeenCalledTimes(1);
			expect(apiGet).toHaveBeenCalledWith("/search", {
				params: expect.objectContaining({ q: searchQuery }),
			});
		});

		it("Reports out of quota errors", async () => {
			apiGet.mockRejectedValue({ response: { status: 403 } });

			await expect(adapter.searchVideos("")).rejects.toThrow(OutOfQuotaException);
		});

		it("Re-throws all other errors", async () => {
			const response = { response: { status: 400 } };
			apiGet.mockRejectedValue(response);

			const promise = adapter.searchVideos("");
			await expect(promise).rejects.toEqual(response);
			await expect(promise).rejects.not.toBeInstanceOf(OutOfQuotaException);
		});
	});

	describe("videoApiRequest", () => {
		const adapter = new YouTubeAdapter("", redisClient, redisClientAsync);
		const apiGet = jest.spyOn(adapter.api, "get");
		const outOfQuotaResponse = {
			isAxiosError: true,
			response: {
				status: 403,
				data: { error: { code: 403, message: "", errors: [], status: "" } },
			},
		} as unknown as AxiosError<YoutubeErrorResponse>;

		beforeEach(() => {
			apiGet.mockReset();
		});

		it("should use the fallback when out of quota, and onlyProperties contains length", async () => {
			apiGet.mockRejectedValue(outOfQuotaResponse);
			const fallbackSpy = jest.spyOn(adapter, "getVideoLengthFallback").mockResolvedValue(10);
			const videos = await adapter.videoApiRequest("BTZ5KVRUy1Q", ["length"]);
			expect(videos[0]).toEqual({
				service: "youtube",
				id: "BTZ5KVRUy1Q",
				length: 10,
				thumbnail: "https://i.ytimg.com/vi/BTZ5KVRUy1Q/default.jpg",
			});
			expect(fallbackSpy).toHaveBeenCalledTimes(1);
			fallbackSpy.mockClear();
		});

		it("should not use the fallback when out of quota, and onlyProperties does NOT contain length", async () => {
			apiGet.mockRejectedValue(outOfQuotaResponse);
			const fallbackSpy = jest.spyOn(adapter, "getVideoLengthFallback").mockResolvedValue(10);
			expect(adapter.videoApiRequest("BTZ5KVRUy1Q", ["title"])).rejects.toThrow(
				new OutOfQuotaException("youtube")
			);
			expect(fallbackSpy).toHaveBeenCalledTimes(0);
			fallbackSpy.mockClear();
		});

		it("should reject when the function fails for unknown reason", async () => {
			apiGet.mockRejectedValue(new Error("other error"));
			expect(adapter.videoApiRequest("BTZ5KVRUy1Q", ["title"])).rejects.toThrow(
				new Error("other error")
			);
		});
	});

	describe("parseVideoLength", () => {
		it.each([
			["PT10S", 10],
			["PT5M", 5 * 60],
			["PT40M25S", 40 * 60 + 25],
			["PT1H", 1 * 60 * 60],
			["PT1H40M25S", 1 * 60 * 60 + 40 * 60 + 25],
			["P1DT3S", 86403],
			["P1D", 86400],
		])("should parse %s into %s seconds", (timecode, seconds) => {
			expect(adapter.parseVideoLength(timecode)).toEqual(seconds);
		});
	});

	describe("getChannelId", () => {
		it.each([
			["https://youtube.com/@rollthedyc3", { handle: "@rollthedyc3" }],
			["https://youtube.com/user/vinesauce", { user: "vinesauce" }],
			[
				"https://youtube.com/channel/UCI1XS_GkLGDOgf8YLaaXNRA",
				{ channel: "UCI1XS_GkLGDOgf8YLaaXNRA" },
			],
			["https://youtube.com/c/rollthedyc3", { customUrl: "rollthedyc3" }],
			["https://youtube.com/rollthedyc3", { customUrl: "rollthedyc3" }],
		])("should parse channel url %s into channel data %s", (url, channelData) => {
			expect(adapter.getChannelId(new URL(url))).toEqual(channelData);
		});
	});
});
