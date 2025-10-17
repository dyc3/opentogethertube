import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import GoogleDriveAdapter from "../../../../server/services/googledrive.js";

const testApiKey = "rush-catnip-abreast-unsaved";

describe("Google Drive", () => {
	describe("canHandleURL", () => {
		const adapter = new GoogleDriveAdapter(testApiKey);

		it("Accepts share links", () => {
			const url = "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
			expect(adapter.canHandleURL(url)).toBe(true);
		});

		it("Rejects other URLs", () => {
			const url = "https://example.com/somevideo";
			expect(adapter.canHandleURL(url)).toBe(false);
		});
	});

	describe("isCollectionURL", () => {
		const adapter = new GoogleDriveAdapter(testApiKey);

		it("Returns true for folders", () => {
			const url =
				"https://drive.google.com/drive/folders/bnas098dh9asund982hlkahsd9?usp=sharing";
			expect(adapter.isCollectionURL(url)).toBe(true);
		});

		it("Returns false for other URLs", () => {
			const url = "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
			expect(adapter.isCollectionURL(url)).toBe(false);
		});
	});

	describe("getVideoId", () => {
		const adapter = new GoogleDriveAdapter(testApiKey);

		it("Extracts file IDs", () => {
			const url = "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";
			expect(adapter.getVideoId(url)).toBe("0ashda098sd892oihas");
		});
	});

	describe("fetchVideoInfo", () => {
		const adapter = new GoogleDriveAdapter(testApiKey);
		vi.spyOn(adapter.api, "get");
		const videoId = "08ahsdlk0218";
		const apiGet = vi.fn().mockResolvedValue({
			data: {
				id: videoId,
				name: "Test video",
				thumbnailLink: "https://example.com/thumbnail.jpg",
				videoMediaMetadata: {
					durationMillis: 100000,
				},
				mimeType: "video/mp4",
				src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
			},
		});
		adapter.api.get = apiGet;

		it("Returns a promise", () => {
			expect(adapter.fetchVideoInfo(videoId)).toBeInstanceOf(Promise);
		});

		it("Queries the Google Drive API", () => {
			expect(adapter.api.get).toBeCalled();
		});

		it("Returns a video", async () => {
			const video = await adapter.fetchVideoInfo(videoId);

			expect(video).toMatchObject({
				service: "googledrive",
				id: videoId,
				thumbnail: "https://example.com/thumbnail.jpg",
				length: 100,
				mime: "video/mp4",
				src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
			});
		});
	});

	describe("resolveURL", () => {
		const adapter = new GoogleDriveAdapter(testApiKey);
		vi.spyOn(adapter.api, "get");

		it("Resolves URLs to single videos", async () => {
			const url = "https://drive.google.com/file/d/0ashda098sd892oihas/view?usp=sharing";

			const videoId = "0ashda098sd892oihas";
			const apiGet = vi.fn().mockResolvedValue({
				data: {
					id: videoId,
					name: "Test video",
					thumbnailLink: "https://example.com/thumbnail.jpg",
					videoMediaMetadata: {
						durationMillis: 100000,
					},
					mimeType: "video/mp4",
					src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
				},
			});
			adapter.api.get = apiGet;

			const videos = await adapter.resolveURL(url);
			expect(videos).toHaveLength(1);
			expect(videos[0]).toEqual({
				service: "googledrive",
				id: videoId,
				title: "Test video",
				thumbnail: "https://example.com/thumbnail.jpg",
				length: 100,
				mime: "video/mp4",
				src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
			});
		});

		it("Resolves a folder URL to a list of videos", async () => {
			const folderId = "bnas098dh9asund982hlkahsd9";
			const videoIds = ["08ahsdlk0218", "09asdkj2130jklasdh"];
			const url = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

			const files = videoIds.map((videoId, idx) => ({
				id: videoId,
				name: `Video ${videoId}`,
				thumbnailLink: `thumbnail${videoId}`,
				videoMediaMetadata: { durationMillis: 100000 * (idx + 1) },
				mimeType: "video/mp4",
				src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
			}));
			const apiGet = vi.fn().mockResolvedValue({
				data: {
					files,
				},
			});
			adapter.api.get = apiGet;
			const videos = await adapter.resolveURL(url);

			expect(Array.isArray(videos)).toBe(true);
			expect(videos.length).toBe(videoIds.length);

			videoIds.forEach((videoId, idx) => {
				expect(videos[idx]).toMatchObject({
					service: "googledrive",
					id: videoId,
					title: `Video ${videoId}`,
					thumbnail: `thumbnail${videoId}`,
					length: 100 * (idx + 1),
					mime: "video/mp4",
					src_url: `https://www.googleapis.com/drive/v3/files/${videoId}?key=${testApiKey}&alt=media&aknowledgeAbuse=true`,
				});
			});
		});
	});
});
