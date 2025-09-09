import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import OdyseeAdapter from "../../../services/odysee.js";
import axios from "axios";
import { OdyseeDrmProtectedVideo } from "../../../exceptions.js";

vi.mock("axios", () => ({
	default: {
		post: vi.fn(),
		head: vi.fn(),
		get: vi.fn(),
	},
}));

describe("OdyseeAdapter", () => {
	beforeEach(() => {
		(axios.post as any).mockReset();
		(axios.head as any).mockReset();
		(axios.get as any).mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns HLS correctly (keeps master URL)", async () => {
		const adapter = new OdyseeAdapter();
		const odyUrl = "https://odysee.com/@Foo:ab/Bar:cd";
		const lbryUri = "lbry://@Foo#ab/Bar#cd";
		const masterUrl = "https://cdn.example/master.m3u8";

		(axios.post as any).mockResolvedValueOnce({
			data: {
				result: {
					[lbryUri]: {
						canonical_url: lbryUri,
						value_type: "stream",
						value: {
							title: "Test title",
							video: { duration: 600 },
							thumbnail: "https://thumb.test/img.jpg",
						},
					},
				},
			},
		});

		(axios.post as any).mockResolvedValueOnce({
			data: {
				result: {
					streaming_url: masterUrl,
					mime_type: "application/x-mpegurl",
					value: {
						title: "Test title",
						description: "Desc",
						video: { duration: 600 },
						thumbnail: "https://thumb.test/img.jpg",
					},
				},
			},
		});

		(axios.head as any).mockResolvedValue({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: masterUrl } },
		});

		(axios.get as any).mockResolvedValue({
			status: 200,
			data: `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p.m3u8`,
		});

		// Sanity check: URL -> lbry conversion
		const id = adapter.getVideoId(odyUrl);
		expect(id).toBe(lbryUri);

		const v = await adapter.fetchVideoInfo(id);

		expect(v.service).toBe("odysee");
		expect(v.mime).toBe("application/x-mpegURL");
		expect((v as any).hls_url).toBe(masterUrl);
		expect(v.id).toBe(masterUrl);
		expect(v.title).toBe("Test title");
		expect(v.length).toBe(600);
		expect(v.thumbnail).toBe("https://thumb.test/img.jpg");
	});

	it("throws OdyseeDrmProtectedVideo when license indicates copyright restrictions", async () => {
		const adapter = new OdyseeAdapter();
		const lbryUri = "lbry://@Foo#ab/Bar#cd";

		// resolve reports a copyrighted license -> adapter should throw immediately
		(axios.post as any).mockResolvedValueOnce({
			data: {
				result: {
					[lbryUri]: {
						canonical_url: lbryUri,
						value_type: "stream",
						value: { title: "DRM", license: "Copyrighted (contact publisher)" },
					},
				},
			},
		});

		await expect(adapter.fetchVideoInfo(lbryUri)).rejects.toBeInstanceOf(
			OdyseeDrmProtectedVideo
		);
	});

	it("getVideoId throws for non-Odysee URLs", () => {
		const adapter = new OdyseeAdapter();
		expect(() => adapter.getVideoId("https://example.com/not-odysee")).toThrow();
	});
});
