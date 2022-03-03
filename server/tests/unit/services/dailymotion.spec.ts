import DailyMotionAdapter from "../../../../server/services/dailymotion";
import { InvalidVideoIdException } from "../../../../server/exceptions";

const validVideoLinks = [
	["jriwl35", "https://www.dailymotion.com/video/jriwl35"],
	["jriwl35", "https://dailymotion.com/video/jriwl35"],
	["jriwl35", "https://dai.ly/jriwl35"],
	[
		"k4n9fchBAWl3NmwfLhV",
		"https://www.dailymotion.com/embed/video/k4n9fchBAWl3NmwfLhV?autoplay=false&queue-enable=false",
	],
];

const invalidLinks = [
	"https://example.com",
	"https://dai.ly",
	"https://dailymotion.com",
	"https://dailymotion.com/jriwl35",
];

describe("Dailymotion", () => {
	describe("canHandleURL", () => {
		const adapter = new DailyMotionAdapter();

		it.each(validVideoLinks.map(l => l[1]))("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new DailyMotionAdapter();

		it("Always returns false because collections aren't supported", () => {
			expect(adapter.isCollectionURL("")).toBe(false);
		});
	});

	describe("getVideoId", () => {
		const adapter = new DailyMotionAdapter();

		it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
			expect(adapter.getVideoId(link)).toBe(id);
		});
	});

	describe("fetchVideoInfo", () => {
		const adapter = new DailyMotionAdapter();
		const apiGet = jest.fn();
		apiGet.mockReturnValue({ data: {} });
		adapter.api.get = apiGet;
		const videoId = "jriwl35";

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
