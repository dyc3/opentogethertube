const InfoExtractor = require("../../../server/infoextractor");
const storage = require("../../../storage");
const { getMimeType } = require("../../../server/mime");
const YouTubeAdapter = require("../../../server/services/youtube");
const Video = require("../../../common/video");
const { UnsupportedMimeTypeException, OutOfQuotaException } = require("../../../server/exceptions");
const ServiceAdapter = require("../../../server/serviceadapter");
const { redisClient } = require("../../../redisclient");
const _ = require("lodash");

class TestAdapter extends ServiceAdapter {
	get serviceId() {
		return "fakeservice";
	}
}

describe("InfoExtractor", () => {
	describe("isURL", () => {
		const validUrls = [
			"https://example.com",
			"https://example.com/",
			"https://youtube.com",
			"http://vimeo.com/98239832",
			"http://youtu.be/98239832",
			"http://example.com/video.mp4",
		];

		it.each(validUrls)(
			"Should be valid URL: %s",
			(link) => {
				expect(InfoExtractor.isURL(link)).toBe(true);
			}
		);
	});

	describe("getServiceAdapter", () => {
		it("should get the correct adapter", () => {
			expect(InfoExtractor.getServiceAdapter("youtube")).toBeInstanceOf(YouTubeAdapter);
		});
	});

	describe("getServiceAdapterForURL", () => {
		const cases = [
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
		const vid = {
			service: "fakeservice",
			id: "asdf1234",
			title: "asdf",
			description: "desc",
			length: 10,
		};

		it("should use cached search results", async () => {
			let redisGet = jest.spyOn(redisClient, "get")
				.mockImplementation((key, callback) => callback(null, JSON.stringify([_.pick(vid, "service", "id")])));
			let redisSet = jest.spyOn(redisClient, "set").mockImplementation();
			let adapter = new TestAdapter();
			let getAdapterSpy = jest.spyOn(InfoExtractor, 'getServiceAdapter').mockReturnValue(adapter);
			let getCacheSpy = jest.spyOn(InfoExtractor, 'getCachedSearchResults');
			let getManyVideoInfoSpy = jest.spyOn(InfoExtractor, 'getManyVideoInfo').mockResolvedValue([new Video(vid)]);
			let results = await InfoExtractor.searchVideos(adapter.serviceId, "asdf");
			expect(redisGet).toBeCalledTimes(1);
			expect(getAdapterSpy).toBeCalledTimes(0);
			expect(getCacheSpy).toBeCalledTimes(1);
			expect(getManyVideoInfoSpy).toBeCalledTimes(1);
			expect(results).toEqual([new Video(vid)]);

			getManyVideoInfoSpy.mockRestore();
			getCacheSpy.mockRestore();
			getAdapterSpy.mockRestore();
			redisGet.mockRestore();
			redisSet.mockRestore();
		});

		it("should cache fresh search results", async () => {
			let redisGet = jest.spyOn(redisClient, "get")
				.mockImplementation((key, callback) => callback(null, null));
			let redisSet = jest.spyOn(redisClient, "set").mockImplementation();
			let adapter = new TestAdapter();
			let getAdapterSpy = jest.spyOn(InfoExtractor, 'getServiceAdapter').mockReturnValue(adapter);
			let getCacheSpy = jest.spyOn(InfoExtractor, 'getCachedSearchResults').mockResolvedValue(null);
			let searchSpy = jest.spyOn(adapter, 'searchVideos').mockResolvedValue([
				new Video({
					service: "fakeservice",
					id: "asdf1234",
				}),
			]);
			let getManyVideoInfoSpy = jest.spyOn(InfoExtractor, 'getManyVideoInfo').mockResolvedValue([new Video(vid)]);

			let results = await InfoExtractor.searchVideos(adapter.serviceId, "asdf");

			expect(results).toEqual([new Video(vid)]);

			expect(getAdapterSpy).toBeCalledTimes(1);
			expect(getManyVideoInfoSpy).toBeCalledTimes(1);
			expect(searchSpy).toBeCalledTimes(1);
			expect(redisSet).toBeCalledTimes(1);
			expect(redisSet.mock.calls[0][0]).toEqual(`search:${adapter.serviceId}:asdf`);

			searchSpy.mockRestore();
			getCacheSpy.mockRestore();
			redisGet.mockRestore();
			redisSet.mockRestore();
		});

	});

	describe("getVideoInfo", () => {
		let getAdapter;
		let getCachedVideo;
		let updateCache;
		let adapterFetchVideoInfo;
		beforeAll(() => {
			let adapter = new TestAdapter();
			getAdapter = jest.spyOn(InfoExtractor, 'getServiceAdapter').mockReturnValue(adapter);
			getCachedVideo = jest.spyOn(InfoExtractor, 'getCachedVideo').mockImplementation();
			updateCache = jest.spyOn(InfoExtractor, 'updateCache').mockImplementation();
			adapterFetchVideoInfo = jest.spyOn(adapter, 'fetchVideoInfo');
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
		});

		let vid = new Video({
			service: "fakeservice",
			id: "asdf",
			title: "title",
			description: "desc",
			length: 10,
			thumbnail: "https://example.com/asdf",
		});
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
			adapterFetchVideoInfo.mockRejectedValue(new OutOfQuotaException());
			expect(await InfoExtractor.getVideoInfo("youtube", "asdf")).toEqual(_.pick(vid, "service", "id", "length"));
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});

		it("should fail with OutOfQuotaException if the video is not in the cache and out of quota", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "thumbnail", "length", "mime"],
			]);
			adapterFetchVideoInfo.mockRejectedValue(new OutOfQuotaException());
			await expect(InfoExtractor.getVideoInfo("youtube", "asdf")).rejects.toThrowError(OutOfQuotaException);
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});

		it("should fail with other errors", async () => {
			getCachedVideo.mockResolvedValue([
				_.pick(vid, "service", "id", "length"),
				// eslint-disable-next-line array-bracket-newline
				["title", "description", "thumbnail"],
			]);
			adapterFetchVideoInfo.mockRejectedValue(new Error("fake"));
			await expect(InfoExtractor.getVideoInfo("youtube", "asdf")).rejects.toThrow(new Error("fake"));
			expect(adapterFetchVideoInfo).toBeCalledTimes(1);
		});
	});
});

describe("InfoExtractor: Cache", () => {
	describe("getCachedVideo", () => {
		it("should get video from cache", async () => {
			jest.spyOn(storage, 'getVideoInfo').mockReturnValue({
				service: "youtube",
				id: "94L1GMA2wjk4",
				title: "example",
			});
			expect(await InfoExtractor.getCachedVideo("youtube", "94L1GMA2wjk4")).toEqual([
				new Video({
					service: "youtube",
					id: "94L1GMA2wjk4",
					title: "example",
				}),
				[
					"description",
					"thumbnail",
					"length",
				],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			storage.getVideoInfo.mockReset();

			jest.spyOn(storage, 'getVideoInfo').mockReturnValue({
				service: "direct",
				id: "https://example.com/asdf.mp4",
				title: "asdf.mp4",
			});
			expect(await InfoExtractor.getCachedVideo("direct", "https://example.com/asdf.mp4")).toEqual([
				new Video({
					service: "direct",
					id: "https://example.com/asdf.mp4",
					title: "asdf.mp4",
				}),
				[
					"description",
					"thumbnail",
					"length",
					"mime",
				],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			storage.getVideoInfo.mockReset();

			jest.spyOn(storage, 'getVideoInfo').mockReturnValue({
				service: "direct",
				id: "https://example.com/asdf.mp4",
				title: "asdf.mp4",
				mime: "video/mp4",
			});
			expect(await InfoExtractor.getCachedVideo("direct", "https://example.com/asdf.mp4")).toEqual([
				new Video({
					service: "direct",
					id: "https://example.com/asdf.mp4",
					title: "asdf.mp4",
					mime: "video/mp4",
				}),
				[
					"description",
					"thumbnail",
					"length",
				],
			]);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			storage.getVideoInfo.mockReset();

			jest.spyOn(storage, 'getVideoInfo').mockReturnValue({
				service: "direct",
				id: "https://example.com/asdf",
				title: "asdf",
				mime: "invalid",
			});
			expect(InfoExtractor.getCachedVideo("direct", "https://example.com/asdf")).rejects.toThrow(UnsupportedMimeTypeException);
			expect(storage.getVideoInfo).toBeCalledTimes(1);
			storage.getVideoInfo.mockReset();
		});
	});

	describe("updateCache", () => {
		beforeEach(() => {
			jest.spyOn(storage, 'updateVideoInfo').mockImplementation();
			jest.spyOn(storage, 'updateManyVideoInfo').mockImplementation();
		});

		afterAll(() => {
			storage.updateVideoInfo.mockRestore();
			storage.updateManyVideoInfo.mockRestore();
		});

		it("should call the correct method to update the cache", () => {
			InfoExtractor.updateCache(new Video());
			expect(storage.updateVideoInfo).toBeCalledTimes(1);
			expect(storage.updateManyVideoInfo).not.toBeCalled();

			storage.updateVideoInfo.mockClear();
			storage.updateManyVideoInfo.mockClear();

			InfoExtractor.updateCache([new Video()]);
			expect(storage.updateVideoInfo).not.toBeCalled();
			expect(storage.updateManyVideoInfo).toBeCalledTimes(1);

			storage.updateVideoInfo.mockClear();
			storage.updateManyVideoInfo.mockClear();
		});
	});
});
