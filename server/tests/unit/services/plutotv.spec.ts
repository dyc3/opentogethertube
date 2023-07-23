import PlutoAdapter, { PlutoBootResponse, type PlutoParsedIds } from "../../../services/pluto";
import { AxiosResponse } from "axios";
import fs from "fs";

const singleVideoLinks: [string, PlutoParsedIds][] = [
	[
		"https://pluto.tv/en/on-demand/movies/616872fc0b4e8f001a960443/details",
		{
			videoType: "movie",
			id: "616872fc0b4e8f001a960443",
		},
	],
	[
		"https://pluto.tv/en/on-demand/movies/629ff609cb032400134d42bc",
		{
			videoType: "movie",
			id: "629ff609cb032400134d42bc",
		},
	],
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
];

const seriesLinks: [string, PlutoParsedIds][] = [
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/details/season/1",
		{
			videoType: "series",
			id: "603db25de7c979001a88f77a",
			season: 1,
		},
	],
	[
		"https://pluto.tv/en/on-demand/series/6234b65ffc8de900130ab0d2/details/season/1",
		{
			videoType: "series",
			id: "6234b65ffc8de900130ab0d2",
			season: 1,
		},
	],
];

const validLinks = [...seriesLinks.map(([link, _]) => link)].concat(
	singleVideoLinks.map(([link, _]) => link)
);

describe("Pluto TV", () => {
	const adapter = new PlutoAdapter();

	describe("canHandleURL", () => {
		it.each(validLinks)("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});
	});

	describe("isCollectionURL", () => {
		it.each(seriesLinks.map(l => l[0]))("should be collection url: %s", link => {
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

	describe("parseUrl", () => {
		it.each(singleVideoLinks.concat(seriesLinks))(
			"should be able to parse %s",
			(link, data) => {
				expect(adapter.parseUrl(link)).toEqual(data);
			}
		);
	});

	describe("resolveUrl", () => {
		const adapter = new PlutoAdapter();
		let apiGetSpy: jest.SpyInstance;

		beforeAll(() => {
			apiGetSpy = jest.spyOn(adapter.api, "get").mockImplementation(mockPlutoBoot);
		});

		afterEach(() => {
			apiGetSpy.mockClear();
		});

		afterAll(() => {
			apiGetSpy.mockRestore();
		});

		it.each(singleVideoLinks.map(x => x[0]))(
			`should handle single video %s`,
			async (url: string) => {
				const results = await adapter.resolveURL(url);

				expect(results).toHaveLength(1);
			}
		);

		it.each(seriesLinks)(`should handle whole series %s`, async (url: string) => {
			const results = await adapter.resolveURL(url);

			expect(results).not.toHaveLength(1);
			expect(results).not.toHaveLength(0);
		});

		it.each(seriesLinks)(
			`should only contain episodes from the requested season %s`,
			async (url: string) => {
				const results = await adapter.resolveURL(url);

				// TODO
			}
		);
	});
});

const FIXTURE_DIRECTORY = "./tests/unit/fixtures/services/pluto";

const fixtureMappings = {
	"616872fc0b4e8f001a960443": "boot-v4_movie_titanic.json",
	"629ff609cb032400134d42bc": "boot-v4_movie_forest_gump.json",
	"6234b65ffc8de900130ab0d2": "boot-v4_series_stargate.json",
	"603db25de7c979001a88f77a": "boot-v4_series_judge_judy.json",
};

async function mockPlutoBoot(url, params): Promise<AxiosResponse<PlutoBootResponse>> {
	const seriesId = params.params.seriesIds;
	const file = fixtureMappings[seriesId];
	const response = JSON.parse(fs.readFileSync(`${FIXTURE_DIRECTORY}/${file}`, "utf8"));
	// console.log(JSON.stringify(response, null, 2));
	return {
		data: response,
		status: 200,
		statusText: "OK",
		headers: {},
		config: {
			headers: {} as any,
		},
	};
}
