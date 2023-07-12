import PeertubeAdapter from "../../../services/peertube";
import { InvalidVideoIdException } from "../../../exceptions";

const validVideoLinks = [
	["the.jokertv.eu:7C5YZTLVudL4FLN4JmVvnA", "https://the.jokertv.eu/w/7C5YZTLVudL4FLN4JmVvnA"],
];

const invalidLinks = ["https://the.jokertv.eu/", "https://the.jokertv.eu/w/"];

describe("Vimeo", () => {
	describe("canHandleURL", () => {
		const adapter = new PeertubeAdapter();

		it.each(validVideoLinks.map(l => l[1]))("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new PeertubeAdapter();

		it("Always returns false because collections aren't supported", () => {
			expect(adapter.isCollectionURL("")).toBe(false);
		});
	});

	describe("getVideoId", () => {
		const adapter = new PeertubeAdapter();

		it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
			expect(adapter.getVideoId(link)).toBe(id);
		});
	});

	describe("fetchVideoInfo", () => {
		const adapter = new PeertubeAdapter();
		const apiGet = jest.fn();
		apiGet.mockReturnValue({ data: {} });
		adapter.api.get = apiGet;
		const videoId = "283918572";

		beforeEach(() => {
			apiGet.mockClear();
		});

		it("Returns a promise", () => {
			expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
		});

		it("Queries the Dailymotion API", async () => {
			await adapter.fetchVideoInfo(videoId);
			expect(apiGet).toBeCalled();
		});

		it("Throws an error if videoId is invalid", () => {
			return expect(adapter.fetchVideoInfo("")).rejects.toThrowError(InvalidVideoIdException);
		});
	});
});
