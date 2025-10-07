import type { AxiosRequestHeaders, AxiosResponse } from "axios";
// biome-ignore lint/style/useNodejsImportProtocol: biome migration
import fs from "fs";
import {
	// biome-ignore lint/correctness/noUnusedImports: biome migration
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { InvalidVideoIdException } from "../../../exceptions.js";
// biome-ignore lint/correctness/noUnusedImports: biome migration
import { conf, loadConfigFile } from "../../../ott-config.js";
import PeertubeAdapter from "../../../services/peertube.js";

const validVideoLinks = [
	["the.jokertv.eu:7C5YZTLVudL4FLN4JmVvnA", "https://the.jokertv.eu/w/7C5YZTLVudL4FLN4JmVvnA"],
];

const invalidLinks = ["https://the.jokertv.eu/", "https://the.jokertv.eu/w/"];

const FIXTURE_DIRECTORY = "./tests/unit/fixtures/services/peertube";

describe("Peertube", () => {
	const adapter = new PeertubeAdapter();
	const FIXTURES: Map<string, string> = new Map();
	let apiGetMock: MockInstance;

	beforeAll(async () => {
		await adapter.initialize();

		for (const file of fs.readdirSync(FIXTURE_DIRECTORY)) {
			FIXTURES.set(
				file.split(".")[0],
				fs.readFileSync(`${FIXTURE_DIRECTORY}/${file}`, "utf8")
			);
		}

		apiGetMock = vi.spyOn(adapter.api, "get").mockImplementation(async (url: string) => {
			const videoid = adapter.getVideoId(url);
			// biome-ignore lint/correctness/noUnusedVariables: biome migration
			const [host, id] = videoid.split(":");
			const fixtureText = FIXTURES.get(id);
			if (!fixtureText) {
				throw new Error(`Fixture not found for ${id}`);
			}
			// biome-ignore lint/suspicious/noImplicitAnyLet: biome migration
			let data;
			try {
				data = JSON.parse(fixtureText);
			// biome-ignore lint/correctness/noUnusedVariables: biome migration
			} catch (e) {
				data = fixtureText;
			}
			const resp: AxiosResponse = {
				status: 200,
				statusText: "OK",
				data,
				headers: {},
				config: {
					headers: {} as AxiosRequestHeaders,
				},
			};
			return resp;
		});
	});

	beforeEach(() => {
		apiGetMock.mockClear();
	});

	describe("canHandleURL", () => {
		it.each(validVideoLinks.map(l => l[1]))("Accepts %s", link => {
			expect(adapter.canHandleURL(link)).toBe(true);
		});

		it.each(invalidLinks)("Rejects %s", link => {
			expect(adapter.canHandleURL(link)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		it("Always returns false because collections aren't supported", () => {
			expect(adapter.isCollectionURL("")).toBe(false);
		});
	});

	describe("getVideoId", () => {
		it.each(validVideoLinks)("Extracts %s from %s", (id, link) => {
			expect(adapter.getVideoId(link)).toBe(id);
		});
	});

	describe("fetchVideoInfo", () => {
		const videoId = "the.jokertv.eu:no-hls";

		it("Returns a promise", () => {
			expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
		});

		it("Throws an error if videoId is invalid", () => {
			return expect(adapter.fetchVideoInfo("")).rejects.toThrowError(InvalidVideoIdException);
		});
	});

	it("Fetches no-hls video as peertube video", async () => {
		conf.set("info_extractor.peertube.emit_as_direct", false);
		const result = await adapter.fetchVideoInfo("the.jokertv.eu:no-hls");
		expect(apiGetMock).toBeCalled();

		expect(result).toMatchObject({
			service: "peertube",
			id: "the.jokertv.eu:no-hls",
			title: "Cycles Demoreel 2014",
			length: 94,
			thumbnail:
				"https://the.jokertv.eu/static/thumbnails/4181f15c-d5b3-4a5c-8981-51a0aa5dce49.jpg",
		});
	});

	it("Fetches no-hls video as direct video", async () => {
		conf.set("info_extractor.peertube.emit_as_direct", true);
		const result = await adapter.fetchVideoInfo("the.jokertv.eu:no-hls");
		expect(apiGetMock).toBeCalled();

		expect(result).toMatchObject({
			service: "direct",
			id: "https://video.blender.org/static/webseed/35a0adab-40e2-4080-a8e8-a8b28afd4180-1080.mp4",
			title: "Cycles Demoreel 2014",
			length: 94,
			thumbnail:
				"https://the.jokertv.eu/static/thumbnails/4181f15c-d5b3-4a5c-8981-51a0aa5dce49.jpg",
		});
	});
});
