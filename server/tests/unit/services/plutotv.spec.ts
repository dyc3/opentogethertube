import PlutoAdapter, { PlutoBootResponse, type PlutoParsedIds } from "../../../services/pluto";
import { AxiosResponse } from "axios";
import fs from "fs";
import { VideoRequest } from "../../../serviceadapter";

const singleVideoLinks: [string, PlutoParsedIds][] = [
	[
		"https://pluto.tv/en/on-demand/movies/616872fc0b4e8f001a960443/details",
		{
			type: "movies",
			id: "616872fc0b4e8f001a960443",
		},
	],
	[
		"https://pluto.tv/en/on-demand/movies/629ff609cb032400134d42bc",
		{
			type: "movies",
			id: "629ff609cb032400134d42bc",
		},
	],
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/season/1/episode/603db2a8e7c979001a890535",
		{
			type: "series",
			id: "603db25de7c979001a88f77a",
			subid: "603db2a8e7c979001a890535",
		},
	],
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/season/2/episode/624ddac8d0f36a0013e5477f",
		{
			type: "series",
			id: "603db25de7c979001a88f77a",
			subid: "624ddac8d0f36a0013e5477f",
		},
	],
];

const seriesLinks: [string, PlutoParsedIds][] = [
	[
		"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/details/season/1",
		{
			type: "series",
			id: "603db25de7c979001a88f77a",
			season: 1,
		},
	],
	[
		"https://pluto.tv/en/on-demand/series/6234b65ffc8de900130ab0d2",
		{
			type: "series",
			id: "6234b65ffc8de900130ab0d2",
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
				`${data.type}/${data.id}${data.subid ? `/${data.subid}` : ""}`
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

		it(`should only contain episodes from season 1`, async () => {
			const results = await adapter.resolveURL(
				"https://pluto.tv/en/on-demand/series/603db25de7c979001a88f77a/details/season/1"
			);

			for (const result of results) {
				expect(result.description?.slice(0, 2)).toEqual("S1");
			}

			expect(results[0]).toMatchObject({
				service: "pluto",
				id: "series/603db25de7c979001a88f77a/603db2a8e7c979001a890535",
				title: "Episode 1",
				length: 1800,
			});
		});
	});

	describe("fetchManyVideoInfo", () => {
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

		it("should fetch many videos with a single request", async () => {
			const requests: VideoRequest[] = [
				{
					id: "series/603db25de7c979001a88f77a/603db2a8e7c979001a890535",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
				{
					id: "series/603db25de7c979001a88f77a/603db2a8e7c979001a890520",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
				{
					id: "series/6234b65ffc8de900130ab0d2/62704a8e73a0a1001450f4c6",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
				{
					id: "movies/629ff609cb032400134d42bc",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
				{
					id: "movies/616872fc0b4e8f001a960443",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
			];
			const result = await adapter.fetchManyVideoInfo(requests);

			expect(result).toHaveLength(5);
		});

		it("should not outright fail if some videos aren't present", async () => {
			const requests: VideoRequest[] = [
				{
					id: "series/603db25de7c979001a88f77a/603db2a8e7c979001a890535",
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
				{
					id: "series/603db25de7c979001a88f77a/703db2a8e7c9e9001z123abc", // doesn't exist
					missingInfo: ["title", "description", "thumbnail", "length"],
				},
			];
			const result = await adapter.fetchManyVideoInfo(requests);

			expect(result).toHaveLength(1);
		});
	});
});

const FIXTURE_DIRECTORY = "./tests/unit/fixtures/services/pluto";

const fixtureMappings = {
	"616872fc0b4e8f001a960443": "boot-v4_movie_titanic.json",
	"629ff609cb032400134d42bc": "boot-v4_movie_forest_gump.json",
	"6234b65ffc8de900130ab0d2": "boot-v4_series_stargate.json",
	"603db25de7c979001a88f77a": "boot-v4_series_judge_judy.json",
	"603db25de7c979001a88f77a,6234b65ffc8de900130ab0d2,629ff609cb032400134d42bc,616872fc0b4e8f001a960443":
		"boot-v4_series_judge_judy_stargate_forest_gump_titanic.json",
};

async function mockPlutoBoot(url, params): Promise<AxiosResponse<PlutoBootResponse>> {
	const seriesId = params.params.seriesIds;
	const file = fixtureMappings[seriesId];
	if (!file) {
		throw new Error(`No fixture mapping for ${seriesId}`);
	}
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
