const InfoExtractor = require("../../../server/infoextractor");
const storage = require("../../../storage");
const { getMimeType } = require("../../../server/mime");
const YouTubeAdapter = require("../../../server/services/youtube");
const Video = require("../../../common/video");
const { UnsupportedMimeTypeException } = require("../../../server/exceptions");

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
