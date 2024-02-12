/**
 * Unit tests for DashVideoAdapter's MPD parsing methods
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi, MockInstance } from "vitest";
import DashVideoAdapter from "../../../services/dash";
import { UnsupportedVideoType } from "../../../exceptions";
import { parseIso8601Duration } from "../../../services/parsing/iso8601";
import axios from "axios";
import { DashMPD } from "@liveinstantly/dash-mpd-parser";
import URL from "url";

vi.mock("axios");
vi.mock("../../../services/parsing/iso8601");
vi.mock("@liveinstantly/dash-mpd-parser");

describe("DashVideoAdapter", () => {
	let adapter: DashVideoAdapter;
	let mockAxiosGet: MockInstance;
	let mockParseIso8601Duration: MockInstance<[string], number>;
	let mockDashMPD: MockInstance;

	beforeEach(() => {
		adapter = new DashVideoAdapter();
		mockAxiosGet = axios.get as MockInstance;
		mockParseIso8601Duration = parseIso8601Duration as MockInstance<[string], number>;
		mockDashMPD = DashMPD as MockInstance;
	});

	describe("handleMpd", () => {
		it("should fetch and parse MPD data", async () => {
			const mockMPDData = `<MPD mediaPresentationDuration="PT10S"></MPD>`;
			const mockManifest = { MPD: { "@mediaPresentationDuration": "PT10S" } };
			mockAxiosGet.mockResolvedValue({ data: mockMPDData });
			const mockParse = vi.fn();
			mockDashMPD.mockImplementation(() => ({
				parse: mockParse,
				getJSON: () => mockManifest,
			}));

			const url = URL.parse("http://example.com/video.mpd");
			await adapter.handleMpd(url);

			expect(mockAxiosGet).toHaveBeenCalledWith(url.href);
			expect(mockParse).toHaveBeenCalledWith(mockMPDData);
		});
	});

	describe("parseMpdManifest", () => {
		it("should throw UnsupportedVideoType for live streams", () => {
			const manifest = { MPD: { "@profiles": "isoff-live" } };
			const url = URL.parse("http://example.com/video.mpd");

			expect(() => {
				adapter.parseMpdManifest(url, manifest);
			}).toThrow(UnsupportedVideoType);
		});

		it("should parse duration and return a Video object", () => {
			const durationRaw = "PT1H2M3S";
			const durationInSeconds = 3723;
			mockParseIso8601Duration.mockReturnValue(durationInSeconds);
			const manifest = { MPD: { "@mediaPresentationDuration": durationRaw } };
			const url = URL.parse("http://example.com/video.mpd");

			const video = adapter.parseMpdManifest(url, manifest);

			expect(mockParseIso8601Duration).toHaveBeenCalledWith(durationRaw);
			expect(video.length).toEqual(durationInSeconds);
		});

		it("should extract a title from ProgramInformation", () => {
			const manifest = {
				MPD: {
					"@mediaPresentationDuration": "PT3S",
					"ProgramInformation": { Title: "foo" },
				},
			};
			const url = URL.parse("http://example.com/video.mpd");

			const video = adapter.parseMpdManifest(url, manifest);

			expect(video.title).toEqual("foo");
		});

		it("should extract a title from other places", () => {
			const manifest = {
				MPD: {
					"@mediaPresentationDuration": "PT3S",
					"Period": [{ AdaptationSet: [{ Representation: [{ Title: "foo" }] }] }],
				},
			};
			const url = URL.parse("http://example.com/video.mpd");

			const video = adapter.parseMpdManifest(url, manifest);

			expect(video.title).toEqual("foo");
		});
	});
});
