import TubiAdapter from "../../../../server/services/tubi";
import fs from "fs";
import { AxiosResponse } from "axios";

const singleVideoLinks = [
	["https://tubitv.com/oz/videos/458113/content", "458113"],
	["https://tubitv.com/tv-shows/458113/s01-e01-peter-s?start=true", "458113"],
	["https://tubitv.com/tv-shows/458113", "458113"],
	["https://tubitv.com/movies/501443/daddy-day-care?start=true", "501443"],
	["https://tubitv.com/movies/321860/fred-2-night-of-the-living-fred?start=true", "321860"],
];

const seriesLinks = [
	"https://tubitv.com/series/3843/honey-i-bought-the-house",
	"https://tubitv.com/series/300005705/gordon-behind-bars?start=true",
	"https://tubitv.com/series/3321",
];

const validLinks = [...seriesLinks].concat(singleVideoLinks.map(([link, id]) => link));

const invalidLinks = [
	"https://tubitv.com",
	"https://tubitv.com/series/",
	"https://tubitv.com/tv-shows/",
	"https://tubitv.com/movies/",
];

const FIXTURE_DIRECTORY = "./tests/unit/server/fixtures/services/tubi";

describe("Tubi TV", () => {
	const adapter = new TubiAdapter();
	const FIXTURES: Map<string, string> = new Map();
	let apiGetMock: jest.SpyInstance;

	beforeAll(() => {
		for (let file of fs.readdirSync(FIXTURE_DIRECTORY)) {
			FIXTURES.set(file.split(".")[0], fs.readFileSync(`${FIXTURE_DIRECTORY}/${file}`, "utf8"));
		}

		apiGetMock = jest.spyOn(adapter.api, 'get').mockImplementation(async (url: string) => {
			const id = adapter.isCollectionURL(url) ? new URL(url).pathname.split("/")[2] : adapter.getVideoId(url);
			let fixtureText = FIXTURES.get(id);
			if (!fixtureText) {
				throw new Error(`Fixture not found for ${id}`);
			}
			let data;
			try {
				data = JSON.parse(fixtureText);
			}
			catch (e) {
				data = fixtureText;
			}
			let resp: AxiosResponse = {
				status: 200,
				statusText: "OK",
				data,
				headers: {},
				config: {},
			};
			return resp;
		});
	});

	describe("canHandleURL", () => {
		it.each(validLinks)("Accepts %s", (link) => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", (link) => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		it.each(seriesLinks)("should be collection url: %s", (link) => {
			expect(adapter.isCollectionURL(link)).toEqual(true);
		});

		it.each(singleVideoLinks.map(l => l[0]))("should not be collection url: %s", (link) => {
			expect(adapter.isCollectionURL(link)).toEqual(false);
		});
	});

	describe("getVideoId", () => {
		it.each(singleVideoLinks)("should be able to get the video id from %s", (link, id) => {
			expect(adapter.getVideoId(link)).toEqual(id);
		});
	});

	describe("resolveURL", () => {
		beforeEach(() => {
			apiGetMock.mockClear();
		});

		it.each(singleVideoLinks)("should resolve single video url: %s", async (url: string, id: string) => {
			let videos = await adapter.resolveURL(url);
			expect(apiGetMock).toBeCalledTimes(1);
			expect(videos).toHaveLength(1);
			expect(videos[0]).toMatchObject({
				service: adapter.serviceId,
				id: id,
			});
		});

		it.each(seriesLinks)("should resolve series url: %s", async (url: string) => {
			let videos = await adapter.resolveURL(url);
			expect(apiGetMock).toBeCalledTimes(1);
			expect(videos.length).toBeGreaterThan(1);
			expect(videos[0]).toMatchObject({
				service: adapter.serviceId,
			});
		});
	});
});
