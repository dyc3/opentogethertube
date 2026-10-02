import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { main } from "../../../app.js";
import InfoExtract, { AddPreview } from "../../../infoextractor.js";
import tokens from "../../../auth/tokens.js";
import { OttException } from "ott-common/exceptions.js";

const JSON_CONTENT_TYPE_REGEX = /json/;

describe("Data API", () => {
	let app;
	let getSessionInfoSpy;
	let validateSpy;

	beforeAll(async () => {
		getSessionInfoSpy = vi.spyOn(tokens, "getSessionInfo").mockResolvedValue({
			isLoggedIn: false,
			username: "test",
		});
		validateSpy = vi.spyOn(tokens, "validate").mockResolvedValue(true);
		app = (await main()).app;
	});

	afterAll(() => {
		getSessionInfoSpy.mockRestore();
		validateSpy.mockRestore();
	});

	it("GET /data/previewAdd", async () => {
		let resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockResolvedValue(new AddPreview([], 0));

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(200)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(resp.body.result).toHaveLength(0);
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockRejectedValue({ name: "UnsupportedServiceException", message: "error message" });

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = vi.spyOn(InfoExtract, "resolveVideoQuery").mockRejectedValue({
			name: "InvalidAddPreviewInputException",
			message: "error message",
		});

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
		resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockRejectedValue({ name: "OutOfQuotaException", message: "error message" });

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "test search query" })
			.expect(400)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX)
			.then(resp => {
				expect(resp.body.success).toBe(false);
				expect(resp.body.error).toBeDefined();
				expect(resolveQuerySpy).toBeCalled();
			});

		resolveQuerySpy.mockRestore();
	});

	it("GET /data/previewAdd with adapter parameter", async () => {
		const resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockResolvedValue(new AddPreview([], 0));

		await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "https://example.com/video", adapter: "direct" })
			.expect(200)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX)
			.then(resp => {
				expect(resp.body.success).toBe(true);
				expect(resolveQuerySpy).toHaveBeenCalledWith(
					"https://example.com/video",
					expect.any(String),
					"direct",
				);
			});

		resolveQuerySpy.mockRestore();
	});

	it.each([0, 1])(
		"handles bulk previews with %i of 2 videos available and allows retry",
		async available => {
			const videos = ["https://example.com/one.mp4", "https://example.com/two.mp4"].map(
				id => ({
					service: "direct" as const,
					id,
					title: id,
				}),
			);
			const getVideoInfoSpy = vi
				.spyOn(InfoExtract.getServiceAdapter("direct"), "fetchVideoInfo")
				.mockImplementation(async id => {
					const video = videos.slice(0, available).find(video => video.id === id);
					if (!video) {
						throw new OttException("Video unavailable");
					}
					return video;
				});
			const query = { input: videos.map(video => video.id).join("\n") };
			try {
				const failed = await request(app)
					.get("/api/data/previewAdd")
					.set({ Authorization: "Bearer foobar" })
					.query(query);
				if (available === 0) {
					expect(failed.status).toBe(400);
					expect(failed.body.success).toBe(false);
					expect(failed.headers["cache-control"]).toBeUndefined();
				} else {
					expect(failed.status).toBe(200);
					expect(failed.body.success).toBe(true);
					expect(failed.body.result).toContainEqual(videos[0]);
					expect(failed.headers["cache-control"]).toBe("no-store");
				}

				getVideoInfoSpy.mockImplementation(
					async id => videos.find(video => video.id === id)!,
				);
				const retried = await request(app)
					.get("/api/data/previewAdd")
					.set({ Authorization: "Bearer foobar" })
					.query(query);
				expect(retried.status).toBe(200);
				expect(retried.body.result).toEqual(videos);
				expect(retried.headers["cache-control"]).toContain("max-age=3600");
			} finally {
				getVideoInfoSpy.mockRestore();
			}
		},
	);

	it("GET /data/previewAdd sets private no-store headers when Jellyfin is present", async () => {
		const jellyfinVideo = {
			service: "jellyfin" as const,
			id: "https://my.jellyfin.com::item123::tok_abc",
			title: "Jellyfin Video",
			hls_url: "/api/data/jellyfin/stream/tok_abc/master.m3u8",
			subtitleUrl: "/api/data/jellyfin/subtitles/tok_abc/item123/0/stream.vtt",
		};
		const resolveQuerySpy = vi
			.spyOn(InfoExtract, "resolveVideoQuery")
			.mockResolvedValue(new AddPreview([jellyfinVideo as any], 3600));

		const resp = await request(app)
			.get("/api/data/previewAdd")
			.set({ Authorization: "Bearer foobar" })
			.query({ input: "https://my.jellyfin.com/Items/item123" })
			.expect(200)
			.expect("Content-Type", JSON_CONTENT_TYPE_REGEX);

		expect(resp.body.success).toBe(true);
		expect(resp.headers["cache-control"]).toBe("private, no-cache, no-store, must-revalidate");
		expect(resp.body.result[0].hls_url).not.toContain("api_key");
		expect(resp.body.result[0].hls_url).not.toContain("ApiKey");

		resolveQuerySpy.mockRestore();
	});

	describe("Jellyfin proxy endpoints", () => {
		it("GET /api/data/jellyfin/stream/:tokenRef delegates to jellyfin.proxyStream", async () => {
			const adapter = InfoExtract.getServiceAdapter("jellyfin");
			const proxyStreamSpy = vi
				.spyOn(adapter as any, "proxyStream")
				.mockImplementation(async (tokenRef, subpath, _query, _req, res: any) => {
					res.setHeader("Cache-Control", "private, no-store");
					res.status(200).send(`stream-${tokenRef}-${subpath}`);
				});

			const resp = await request(app)
				.get("/api/data/jellyfin/stream/tok_123/master.m3u8")
				.expect(200);

			expect(resp.text).toBe("stream-tok_123-master.m3u8");
			expect(resp.headers["cache-control"]).toBe("private, no-store");
			expect(proxyStreamSpy).toHaveBeenCalledWith(
				"tok_123",
				"master.m3u8",
				expect.any(Object),
				expect.any(Object),
				expect.any(Object),
			);

			proxyStreamSpy.mockRestore();
		});

		it("GET /api/data/jellyfin/subtitles delegates to jellyfin.proxySubtitle", async () => {
			const adapter = InfoExtract.getServiceAdapter("jellyfin");
			const proxySubtitleSpy = vi
				.spyOn(adapter as any, "proxySubtitle")
				.mockImplementation(async (tokenRef, mediaSourceId, index, res: any) => {
					res.setHeader("Cache-Control", "private, no-store");
					res.status(200).send(`sub-${tokenRef}-${mediaSourceId}-${index}`);
				});

			const resp = await request(app)
				.get("/api/data/jellyfin/subtitles/tok_123/media_abc/0/stream.vtt")
				.expect(200);

			expect(resp.text).toBe("sub-tok_123-media_abc-0");
			expect(resp.headers["cache-control"]).toBe("private, no-store");
			expect(proxySubtitleSpy).toHaveBeenCalledWith(
				"tok_123",
				"media_abc",
				0,
				expect.any(Object),
			);

			proxySubtitleSpy.mockRestore();
		});
	});
});
