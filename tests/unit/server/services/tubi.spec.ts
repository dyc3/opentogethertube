import TubiAdapter from "../../../../server/services/tubi";

const singleVideoLinks = [
	["https://tubitv.com/oz/videos/458113/content", "458113"],
	["https://tubitv.com/tv-shows/458113/s01-e01-peter-s?start=true", "458113"],
	["https://tubitv.com/tv-shows/458113", "458113"],
	["https://tubitv.com/movies/501443/daddy-day-care?start=true", "501443"],
	["https://tubitv.com/movies/321860/fred-2-night-of-the-living-fred?start=true", "321860"],
];

const seriesLinks = ["https://tubitv.com/series/3843/honey-i-bought-the-house", "https://tubitv.com/series/300005705/gordon-behind-bars?start=true"];

const validLinks = [...seriesLinks].concat(singleVideoLinks.map(([link, id]) => link));

const invalidLinks = [
	"https://tubitv.com",
	"https://tubitv.com/series/",
	"https://tubitv.com/tv-shows/",
	"https://tubitv.com/movies/",
];

describe("Tubi TV", () => {
	describe("canHandleURL", () => {
		const adapter = new TubiAdapter();

		it.each(validLinks)("Accepts %s", (link) => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", (link) => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new TubiAdapter();

		it.each(seriesLinks)("should be collection url: %s", (link) => {
			expect(adapter.isCollectionURL(link)).toEqual(true);
		});

		it.each(singleVideoLinks.map(l => l[0]))("should not be collection url: %s", (link) => {
			expect(adapter.isCollectionURL(link)).toEqual(false);
		});
	});

	describe("getVideoId", () => {
		it.each(singleVideoLinks)("should be able to get the video id from %s", (link, id) => {
			const adapter = new TubiAdapter();
			expect(adapter.getVideoId(link)).toEqual(id);
		});
	});

	describe("resolveURL", () => {
		const adapter = new TubiAdapter();

		it("should get video urls", async () => {
			// TODO: write test
		});
	});
});
