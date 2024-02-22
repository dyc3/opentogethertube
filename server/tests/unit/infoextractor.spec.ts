import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
	vi,
	MockInstance,
} from "vitest";
import InfoExtractor, { initExtractor } from "../../infoextractor";
import storage from "../../storage";
import { getMimeType } from "../../mime";
import YouTubeAdapter from "../../services/youtube";
import { UnsupportedMimeTypeException, OutOfQuotaException } from "../../exceptions";
import { ServiceAdapter } from "../../serviceadapter";
import { buildClients, redisClient } from "../../redisclient";
import _ from "lodash";
import { loadModels } from "../../models";
import { loadConfigFile, conf } from "../../ott-config";
import { Video, VideoMetadata, VideoService } from "../../../common/models/video";

class TestAdapter extends ServiceAdapter {
	get serviceId(): VideoService {
		return "fakeservice" as VideoService;
	}
}

describe("InfoExtractor", () => {
	beforeAll(async () => {
		loadConfigFile();
		conf.set("info_extractor.youtube.api_key", "fake");
		loadModels();
		await buildClients();
		await initExtractor();
	});

	describe("isURL", () => {
		const validUrls = [
			"https://example.com",
			"https://example.com/",
			"https://youtube.com",
			"http://vimeo.com/98239832",
			"http://youtu.be/98239832",
			"http://example.com/video.mp4",
			"ott://video/youtube/1",
		];

		it.each(validUrls)("Should be valid URL: %s", link => {
			expect(InfoExtractor.isURL(link)).toBe(true);
		});
	});

	describe("getServiceAdapter", () => {
		it("should get the correct adapter", () => {
			expect(InfoExtractor.getServiceAdapter("youtube")).toBeInstanceOf(YouTubeAdapter);
		});
	});

	describe("getServiceAdapterForURL", () => {
		const cases: [string, unknown][] = [
			["https://youtube.com/watch?v=3kw2_89ym31W", YouTubeAdapter],
			["https://www.youtube.com/watch?v=3kw2_89ym31W", YouTubeAdapter],
			["https://youtube.com/watch?v=3kw2_89ym31W", YouTubeAdapter],
		];

		it.each(cases)("should get the correct adapter: %s", (link, adapterType) => {
			expect(InfoExtractor.getServiceAdapterForURL(link)).toBeInstanceOf(adapterType);
		});
	});

	describe("getMimeType", () => {
		it("should get the correct mime type, or return undefined", () => {
			expect(getMimeType("mp4")).toBe("video/mp4");
			expect(getMimeType("invalid")).toBeUndefined();
		});
	});

	describe("searchVideos", () => {
		const vid: Video = {
			service: "direct",
			id: "asdf1234",
			title: "asdf",
			description: "desc",
			length: 10,
		};

		it("should use cached search results", async () => {
			await redisClient.set("search:fakeservice:asdf", JSON.stringify([vid]));
			let adapter = new TestAdapter();
			let getAdapterSpy = vi
				.spyOn(InfoExtractor, "getServiceAdapter")
				.mockReturnValue(adapter);
			let getCacheSpy = vi
				.spyOn(InfoExtractor, "getCachedSearchResults")
				.mockResolvedValue([vid]);
			let getManyVideoInfoSpy = vi
				.spyOn(InfoExtractor, "getManyVideoInfo")
				.mockResolvedValue([vid]);
			let results = await InfoExtractor.searchVideos(adapter.serviceId, "asdf");
			expect(getAdapterSpy).toBeCalledTimes(0);
			expect(getCacheSpy).toBeCalledTimes(1);
			expect(getManyVideoInfoSpy).toBeCalledTimes(1);
			expect(results).toEqual([vid]);

			getManyVideoInfoSpy.mockRestore();
			getCacheSpy.mockRestore();
			getAdapterSpy.mockRestore();

			await redisClient.del("search:fakeservice:asdf");
		});

		it("should cache fresh search results", async () => {
			let adapter = new TestAdapter();
			let getAdapterSpy = vi
				.spyOn(InfoExtractor, "getServiceAdapter")
				.mockReturnValue(adapter);
			let getCacheSpy = vi
				.spyOn(InfoExtractor, "getCachedSearchResults")
				.mockResolvedValue([]);
			let searchSpy = vi.spyOn(adapter, "searchVideos").mockResolvedValue([
				{
					service: "direct",
					id: "asdf1234",
				},
			]);
			let getManyVideoInfoSpy = vi
				.spyOn(InfoExtractor, "getManyVideoInfo")
				.mockResolvedValue([vid]);

			let results = await InfoExtractor.searchVideos(adapter.serviceId, "asdf");

			expect(results).toEqual([vid]);

			// expect(getAdapterSpy).toBeCalledTimes(1);
			expect(getManyVideoInfoSpy).toBeCalledTimes(1);
			expect(searchSpy).toBeCalledTimes(1);
			expect(
				(await redisClient.get(`search:${adapter.serviceId}:asdf`))!.length
			).toBeGreaterThan(0);

			getManyVideoInfoSpy.mockRestore();
			searchSpy.mockRestore();
			getCacheSpy.mockRestore();

			await redisClient.del("search:fakeservice:asdf");
		});
	});

	describe("getVideoInfo", () => {
		let getAdapter: MockInstance<[string], ServiceAdapter>;
		let getCachedVideo: MockInstance<
			[VideoService, string],
			Promise<[Video, (keyof VideoMetadata)[]]>
		>;
		let updateCache: MockInstance<[Video[] | Video], Promise<void>>;
		let adapterFetchVideoInfo: MockInstance;
		beforeAll(() => {
			let adapter = new TestAdapter();
			getAdapter = vi.spyOn(InfoExtractor, "getServiceAdapter").mockReturnValue(adapter);
			getCachedVideo = vi
				.spyOn(InfoExtractor, "getCachedVideo")
				.mockImplementation((service, id) => {
					return Promise.resolve([
						{
							service,
							id,
						},
						["title", "description", "length", "thumbnail"],
					]);
				});
			updateCache = vi.spyOn(InfoExtractor, "updateCache").mockResolvedValue();
			adapterFetchVideoInfo = vi.spyOn(adapter, "fetchVideoInfo");
		});
		afterEach(() => {
			updateCache.mockClear();
			getCachedVideo.mockReset();
			adapterFetchVideoInfo.mockReset();
		});
		afterAll(() => {
			getAdapter.mockRestore();
			getCachedVideo.mockRestore();
			updateCache.mockRestore();
			adapterFetchVideoInfo.mockRestore();
		});

		let vid: Video = {
			service: "direct",
			id: "asdf",
			title: "title",
			description: "desc",
			length: 10,
			thumbnail: "https://example.com/asdf",
		};
		delete vid.mime;

		it("should get video info from adapter", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "length", "thumbnail"],
			]);
			adapterFetchVideoInfo.mockResolvedValue(vid);
			expect(await InfoExtractor.getVideoInfo("youtube", "asdf")).toEqual(vid);
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
			expect(getCachedVideo).toBeCalledTimes(1);
		});

		it("should update the video in the cache", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "length", "thumbnail"],
			]);
			adapterFetchVideoInfo.mockResolvedValue(vid);
			await InfoExtractor.getVideoInfo("youtube", "asdf");
			expect(updateCache).toBeCalledTimes(1);
			expect(updateCache).toBeCalledWith(vid);
		});

		it("should get video from the cache", async () => {
			getCachedVideo.mockResolvedValue([
				vid,
				// eslint-disable-next-line array-bracket-newline
				[],
			]);
			adapterFetchVideoInfo.mockResolvedValue(vid);
			expect(await InfoExtractor.getVideoInfo("youtube", "asdf")).toEqual(vid);
			expect(adapterFetchVideoInfo).toBeCalledTimes(0);
			expect(getCachedVideo).toBeCalledTimes(1);
		});

		it("should return what's available in the cache if out of quota", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id", "length"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "thumbnail"],
			]);
			adapterFetchVideoInfo.mockRejectedValue(new OutOfQuotaException("fake"));
			expect(await InfoExtractor.getVideoInfo("youtube", "asdf")).toEqual(
				_.pick(vid, "service", "id", "length")
			);
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});

		it("should fail with OutOfQuotaException if the video is not in the cache and out of quota", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "thumbnail", "length", "mime"],
			]);
			adapterFetchVideoInfo.mockRejectedValue(new OutOfQuotaException("fake"));
			await expect(InfoExtractor.getVideoInfo("youtube", "asdf")).rejects.toThrowError(
				OutOfQuotaException
			);
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});

		it("should fail with other errors", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id", "length"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "thumbnail"],
			]);
			adapterFetchVideoInfo.mockRejectedValue(new Error("fake"));
			await expect(InfoExtractor.getVideoInfo("youtube", "asdf")).rejects.toThrow(
				new Error("fake")
			);
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});
	});

	describe("getManyVideoInfo", () => {
		let getAdapter: MockInstance<[string], ServiceAdapter>;
		let getCachedVideo: MockInstance<
			[VideoService, string],
			Promise<[Video, (keyof VideoMetadata)[]]>
		>;
		let updateCache: MockInstance<[Video[] | Video], Promise<void>>;
		let adapterFetchManyVideoInfo: MockInstance;
		let storageGetManyVideoInfo: MockInstance;
		beforeAll(() => {
			let adapter = new TestAdapter();
			getAdapter = vi.spyOn(InfoExtractor, "getServiceAdapter").mockReturnValue(adapter);
			getCachedVideo = vi
				.spyOn(InfoExtractor, "getCachedVideo")
				.mockImplementation((service, id) => {
					return Promise.resolve([
						{
							service,
							id,
						},
						["title", "description", "length", "thumbnail"],
					]);
				});
			updateCache = vi.spyOn(InfoExtractor, "updateCache").mockResolvedValue();
			adapterFetchManyVideoInfo = vi.spyOn(adapter, "fetchManyVideoInfo");
			storageGetManyVideoInfo = vi.spyOn(storage, "getManyVideoInfo");
		});
		afterEach(() => {
			updateCache.mockClear();
			getCachedVideo.mockReset();
			adapterFetchManyVideoInfo.mockReset();
			storageGetManyVideoInfo.mockReset();
		});
		afterAll(() => {
			getAdapter.mockRestore();
			getCachedVideo.mockRestore();
			updateCache.mockRestore();
			storageGetManyVideoInfo.mockRestore();
		});

		const vids: Video[] = [
			{
				service: "direct",
				id: "asdf",
				title: "title",
				description: "desc",
				length: 10,
				thumbnail: "https://example.com/asdf",
				mime: "asdf",
			},
			{
				service: "direct",
				id: "jklp",
				title: "title",
				description: "desc",
				length: 10,
				thumbnail: "https://example.com/asdf",
				mime: "asdf",
			},
		];

		it("should get videos from cache without fetching from adapter", async () => {
			storageGetManyVideoInfo.mockResolvedValue(vids);
			expect(
				await InfoExtractor.getManyVideoInfo(vids.map(vid => _.pick(vid, "service", "id")))
			).toEqual(vids);
			expect(adapterFetchManyVideoInfo).not.toBeCalled();
		});

		it("should get videos fetching from adapter", async () => {
			storageGetManyVideoInfo.mockResolvedValue(
				vids.map(vid => _.pick(vid, "service", "id"))
			);
			adapterFetchManyVideoInfo.mockResolvedValue(vids);
			updateCache.mockResolvedValue();
			expect(
				await InfoExtractor.getManyVideoInfo(vids.map(vid => _.pick(vid, "service", "id")))
			).toEqual(vids);
			expect(adapterFetchManyVideoInfo).toBeCalledTimes(1);
			expect(updateCache).toBeCalledTimes(1);
		});

		it("should get some videos from cache, and the rest fetching from adapter", async () => {
			storageGetManyVideoInfo.mockResolvedValue([vids[0], _.pick(vids[1], "service", "id")]);
			adapterFetchManyVideoInfo.mockResolvedValue(vids);
			updateCache.mockResolvedValue();
			expect(
				await InfoExtractor.getManyVideoInfo(vids.map(vid => _.pick(vid, "service", "id")))
			).toEqual(vids);
			expect(adapterFetchManyVideoInfo).toBeCalledTimes(1);
			expect(updateCache).toBeCalledTimes(1);
		});
	});
});

describe("InfoExtractor: Cache", () => {
	describe("getCachedVideo", () => {
		it("should get video from cache", async () => {
			let getVideoInfoSpy = vi.spyOn(storage, "getVideoInfo").mockResolvedValue({
				service: "youtube",
				id: "94L1GMA2wjk4",
				title: "example",
			});
			expect(await InfoExtractor.getCachedVideo("youtube", "94L1GMA2wjk4")).toEqual([
				{
					service: "youtube",
					id: "94L1GMA2wjk4",
					title: "example",
				},
				["description", "thumbnail", "length"],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			getVideoInfoSpy.mockReset();

			getVideoInfoSpy = vi.spyOn(storage, "getVideoInfo").mockResolvedValue({
				service: "direct",
				id: "https://example.com/asdf.mp4",
				title: "asdf.mp4",
			});
			expect(
				await InfoExtractor.getCachedVideo("direct", "https://example.com/asdf.mp4")
			).toEqual([
				{
					service: "direct",
					id: "https://example.com/asdf.mp4",
					title: "asdf.mp4",
				},
				["description", "thumbnail", "length", "mime"],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			getVideoInfoSpy.mockReset();

			vi.spyOn(storage, "getVideoInfo").mockResolvedValue({
				service: "direct",
				id: "https://example.com/asdf.mp4",
				title: "asdf.mp4",
				mime: "video/mp4",
			});
			expect(
				await InfoExtractor.getCachedVideo("direct", "https://example.com/asdf.mp4")
			).toEqual([
				{
					service: "direct",
					id: "https://example.com/asdf.mp4",
					title: "asdf.mp4",
					mime: "video/mp4",
				},
				["description", "thumbnail", "length"],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			getVideoInfoSpy.mockReset();

			vi.spyOn(storage, "getVideoInfo").mockResolvedValue({
				service: "direct",
				id: "https://example.com/asdf",
				title: "asdf",
				mime: "invalid",
			});
			expect(
				InfoExtractor.getCachedVideo("direct", "https://example.com/asdf")
			).rejects.toThrow(UnsupportedMimeTypeException);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			getVideoInfoSpy.mockReset();
		});
	});

	describe("updateCache", () => {
		let updateVideoInfoSpy;
		let updateManyVideoInfoSpy;
		beforeEach(() => {
			updateVideoInfoSpy = vi.spyOn(storage, "updateVideoInfo").mockResolvedValue(true);
			updateManyVideoInfoSpy = vi
				.spyOn(storage, "updateManyVideoInfo")
				.mockResolvedValue(true);
		});

		afterAll(() => {
			updateVideoInfoSpy.mockRestore();
			updateManyVideoInfoSpy.mockRestore();
		});

		it("should call the correct method to update the cache", () => {
			InfoExtractor.updateCache({} as Video);
			expect(storage.updateVideoInfo).toBeCalledTimes(1);
			expect(storage.updateManyVideoInfo).not.toBeCalled();

			updateVideoInfoSpy.mockClear();
			updateManyVideoInfoSpy.mockClear();

			InfoExtractor.updateCache([{}] as Video[]);
			expect(storage.updateVideoInfo).not.toBeCalled();
			expect(storage.updateManyVideoInfo).toBeCalledTimes(1);

			updateVideoInfoSpy.mockClear();
			updateManyVideoInfoSpy.mockClear();
		});
	});
});
