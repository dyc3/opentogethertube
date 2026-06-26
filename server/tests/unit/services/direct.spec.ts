import { describe, it, expect, vi, afterEach } from "vitest";
import DirectVideoAdapter from "../../../services/direct.js";
import { FfprobeStrategy } from "../../../ffprobe.js";
import fs from "node:fs";

const FIXTURE_DIRECTORY = "./tests/unit/fixtures/services/direct";

class FfprobeFixtures extends FfprobeStrategy {
	async getFileInfo(uri: string): Promise<any> {
		const url = new URL(uri);

		return {
			"/test.mp4": {
				streams: [
					{
						// eslint-disable-next-line camelcase
						codec_type: "video",
						duration: 100,
					},
				],
			},
			"/foo.mp4": this.getFixture("ffprobe-output-has-title.json"),
		}[url.pathname];
	}

	getFixture(file: string) {
		const path = `${FIXTURE_DIRECTORY}/${file}`;
		if (fs.existsSync(path)) {
			const content = fs.readFileSync(path, "utf8");
			return JSON.parse(content);
		}
		throw new Error("fixture not found");
	}
}

describe("Direct", () => {
	describe("canHandleURL", () => {
		const supportedExtensions = [
			"mp4",
			"mp4v",
			"mpg4",
			"webm",
			"flv",
			"mkv",
			"avi",
			"wmv",
			"qt",
			"mov",
			"ogv",
			"m4v",
			"h264",
			"ogg",
			"mp3",
		];

		const adapter = new DirectVideoAdapter();

		it.each(supportedExtensions)("Accepts %s links", extension => {
			const url = `https://example.com/test.${extension}`;
			expect(adapter.canHandleURL(url)).toBe(true);
		});

		const unsupportedExtensions = [
			"jpg",
			"jpeg",
			"png",
			"gif",
			"bmp",
			"tiff",
			"tif",
			"psd",
			"pdf",
			"doc",
			"docx",
			"xls",
			"xlsx",
			"ppt",
			"pptx",
			"zip",
			"rar",
			"7z",
			"tar",
			"gz",
			"mp3v",
			"wav",
		];

		it.each(unsupportedExtensions)("Rejects %s links", extension => {
			const url = `https://example.com/test.${extension}`;
			expect(adapter.canHandleURL(url)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new DirectVideoAdapter();

		it("Always returns false because collections aren't supported", () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.isCollectionURL(url)).toBe(false);
		});
	});

	describe("getVideoId", () => {
		const adapter = new DirectVideoAdapter();

		it("Returns the link itself as the ID", () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.getVideoId(url)).toBe(url);
		});
	});

	describe("fetchVideoInfo", () => {
		const adapter = new DirectVideoAdapter();
		adapter.ffprobe = new FfprobeFixtures();

		it("Returns a promise", async () => {
			const url = "https://example.com/test.mp4";
			expect(adapter.fetchVideoInfo(url)).toBeInstanceOf(Promise);
		});

		it("Returns a video", async () => {
			const url = "https://example.com/test.mp4";
			const video = await adapter.fetchVideoInfo(url);
			expect(video).toMatchObject({
				id: url,
				length: 100,
			});
		});

		it("Returns a video with the title from the metadata", async () => {
			const url = "https://example.com/foo.mp4";
			const video = await adapter.fetchVideoInfo(url);
			expect(video).toMatchObject({
				id: url,
				title: "Foo: The Movie",
				length: 69420,
			});
		});
	});

	describe("fetchManifestInfo", () => {
		const adapter = new DirectVideoAdapter();
		adapter.ffprobe = new FfprobeFixtures();

		function mockManifest(manifest: Record<string, unknown>) {
			vi.spyOn(global, "fetch").mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => manifest,
			} as Response);
		}

		const baseManifest = {
			title: "Manifest Movie",
			duration: 100,
			sources: [{ url: "https://example.com/video.mp4", contentType: "video/mp4" }],
		};

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("exposes the manifest's text tracks on the video", async () => {
			const textTracks = [
				{
					url: "https://example.com/en.vtt",
					contentType: "text/vtt",
					name: "English",
					srclang: "en",
				},
			];
			mockManifest({ ...baseManifest, textTracks });
			const video = await adapter.fetchVideoInfo("https://example.com/media.json");
			expect(video.mime).toEqual("application/json");
			expect(video.textTracks).toEqual(textTracks);
		});

		it("resolves defaultSubtitleTrack from the manifest's default track", async () => {
			mockManifest({
				...baseManifest,
				textTracks: [
					{
						url: "https://example.com/en.vtt",
						contentType: "text/vtt",
						name: "English",
						srclang: "en",
					},
					{
						url: "https://example.com/de.vtt",
						contentType: "text/vtt",
						name: "German",
						srclang: "de",
						default: true,
					},
				],
			});
			const video = await adapter.fetchVideoInfo("https://example.com/media.json");
			expect(video.defaultSubtitleTrack).toEqual("https://example.com/de.vtt");
		});

		it("resolves defaultSubtitleTrack to null when no track is marked default", async () => {
			mockManifest({
				...baseManifest,
				textTracks: [
					{
						url: "https://example.com/en.vtt",
						contentType: "text/vtt",
						name: "English",
						srclang: "en",
					},
				],
			});
			const video = await adapter.fetchVideoInfo("https://example.com/media.json");
			expect(video.defaultSubtitleTrack).toBeNull();
		});

		it("resolves defaultSubtitleTrack to null when there are no text tracks", async () => {
			mockManifest({ ...baseManifest });
			const video = await adapter.fetchVideoInfo("https://example.com/media.json");
			expect(video.textTracks).toBeUndefined();
			expect(video.defaultSubtitleTrack).toBeNull();
		});
	});
});
