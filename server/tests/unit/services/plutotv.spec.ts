import PlutoAdapter, { type PlutoParsedIds } from "../../../services/pluto";

const singleVideoLinks: [string, PlutoParsedIds][] = [
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/season/1/episode/603db2a8e7c979001a890535",
		{
			videoType: "series",
			id: "603db25de7c979001a88f77a",
			subid: "603db2a8e7c979001a890535",
		},
	],
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/season/2/episode/624ddac8d0f36a0013e5477f",
		{
			videoType: "series",
			id: "603db25de7c979001a88f77a",
			subid: "624ddac8d0f36a0013e5477f",
		},
	],
	[
		"https://pluto.tv/en/on-demand/movies/616872fc0b4e8f001a960443/details",
		{
			videoType: "movie",
			id: "616872fc0b4e8f001a960443",
		},
	],
	[
		"https://pluto.tv/en/on-demand/movies/616872fc0b4e8f001a960443",
		{
			videoType: "movie",
			id: "616872fc0b4e8f001a960443",
		},
	],
];

const seriesLinks = [
	"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/details/season/1",
	"https://pluto.tv/en/on-demand/series/6234b65ffc8de900130ab0d2/details/season/1",
];

const validLinks = [...seriesLinks].concat(singleVideoLinks.map(([link, _]) => link));

describe("Pluto TV", () => {
	const adapter = new PlutoAdapter();

	describe("canHandleURL", () => {
		it.each(validLinks)("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});
	});

	describe("isCollectionURL", () => {
		it.each(seriesLinks)("should be collection url: %s", link => {
			expect(adapter.isCollectionURL(link)).toEqual(true);
		});

		it.each(singleVideoLinks.map(l => l[0]))("should not be collection url: %s", link => {
			expect(adapter.isCollectionURL(link)).toEqual(false);
		});
	});

	describe("getVideoId", () => {
		it.each(singleVideoLinks)("should be able to get the video id from %s", (link, data) => {
			expect(adapter.getVideoId(link)).toEqual(
				`${data.id}${data.subid ? `/${data.subid}` : ""}`
			);
		});
	});
});
