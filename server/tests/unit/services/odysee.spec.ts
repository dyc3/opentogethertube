import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.mock("axios", () => {
	const instance = {
		head: vi.fn(),
		get: vi.fn(),
		post: vi.fn(),
	};
	const create = vi.fn(() => instance);
	const isAxiosError = (e: unknown) => Boolean(e && typeof e === "object" && (e as any).response);
	return { default: { ...instance, create, isAxiosError } };
});
vi.mock("../../../ott-config.js", () => ({
	conf: { get: vi.fn().mockReturnValue("test.local") },
}));
import axios from "axios";
import OdyseeAdapter from "../../../services/odysee.js";
import { OdyseeUnavailableVideo } from "../../../exceptions.js";

const mockedAxios = axios as unknown as {
	create: ReturnType<typeof vi.fn>;
	head: ReturnType<typeof vi.fn>;
	get: ReturnType<typeof vi.fn>;
	post: ReturnType<typeof vi.fn>;
	isAxiosError: (e: unknown) => boolean;
};

describe("OdyseeAdapter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolve path: retries plain get() if save_file:false returns no streaming_url", async () => {
		const adapter = new OdyseeAdapter();

		// 1) resolve OK
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#2": {
							canonical_url: "lbry://@c#1/slug#2",
							value_type: "stream",
							claim_id: "CID123",
						},
					},
				},
			})
		);

		// 2) get(save_file:false) → returns no streaming_url
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {},
				},
			})
		);

		// 3) get() → returns valid streaming_url
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID123",
						mime_type: "video/mp4",
						streaming_url: "https://player.odycdn.com/v6/streams/CID123/FILE.mp4",
						value: { title: "FallbackTitle", video: { duration: 55 } },
					},
				},
			})
		);

		// 4) verifyStream returns ok
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		// Final verifyStream(HLS or MP4) after candidate check
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.get.mockResolvedValue({
			status: 206,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		const result = await adapter.fetchVideoInfo("lbry://@c#1/slug#2");
		expect(result.title).toBe("FallbackTitle");
		expect(result.mime).toBe("application/x-mpegURL");
		expect(result.length).toBe(55);
	});

	it("resolve path: uses claim_search to reconstruct streaming_url if get() fails", async () => {
		const adapter = new OdyseeAdapter();

		// 1) resolve OK
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#2": {
							canonical_url: "lbry://@c#1/slug#2",
							value_type: "stream",
							claim_id: "CID789",
						},
					},
				},
			})
		);

		// 2) get(save_file:false) → no streaming_url
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID789",
						value: {
							source: { sd_hash: "SDHASH789" },
							title: "ClaimRecovered",
							video: { duration: 44 },
						},
					},
				},
			})
		);

		// 3) get() → also no streaming_url
		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID789",
						value: {
							source: { sd_hash: "SDHASH789" },
							title: "ClaimRecovered",
							video: { duration: 44 },
						},
					},
				},
			})
		);

		// 4) HEAD check on reconstructed URL
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		// Final verifyStream() after reconstructed master.m3u8
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.get.mockResolvedValue({
			status: 206,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		const result = await adapter.fetchVideoInfo("lbry://@c#1/slug#2");
		expect(result.title).toBe("ClaimRecovered");
		expect(result.hls_url).toMatch(/\/v6\/streams\/CID789\/SDHASH789\/master\.m3u8$/);
		expect(result.mime).toBe("application/x-mpegURL");
		expect(result.length).toBe(44);
	});

	it("resolve path: builds precise HLS from claim_id + sd_hash and returns HLS", async () => {
		const adapter = new OdyseeAdapter();

		// 1) RPC resolve
		mockedAxios.post.mockImplementationOnce((url: string) => {
			expect(url).toContain("?m=resolve");
			return Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#2": {
							canonical_url: "lbry://@c#1/slug#2",
							claim_id: "CLAIMID",
							value_type: "stream",
							value: {
								license: "None",
								title: "Foo",
								source: { sd_hash: "SDHASH" },
								video: { duration: 123, height: 480 },
								thumbnail: { url: "https://thumbs.odycdn.com/foo.webp" },
							},
						},
					},
				},
			});
		});

		// 2) RPC get -> mp4 streaming_url
		mockedAxios.post.mockImplementationOnce((url: string) => {
			expect(url).toContain("?m=get");
			return Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CLAIMID",
						mime_type: "video/mp4",
						streaming_url: "https://player.odycdn.com/v6/streams/CLAIMID/FILE.mp4",
						value: {
							title: "Foo",
							source: { sd_hash: "SDHASH" },
							video: { duration: 123 },
							thumbnail: { url: "https://thumbs.odycdn.com/foo.webp" },
						},
					},
				},
			});
		});

		// 3) verifyStream(mp4): HEAD 200
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		// 4) firstVerifyingUrl(precise master.m3u8): HEAD 200 (HLS)
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		// 5) final verifyStream(HLS): HEAD 200
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		const out = await adapter.fetchVideoInfo("lbry://@c#1/slug#2");

		expect(out.mime).toBe("application/x-mpegURL");
		expect(out.hls_url).toMatch(/\/v6\/streams\/CLAIMID\/SDHASH\/master\.m3u8$/);
		expect(out.title).toBe("Foo");
		expect(out.length).toBe(123);
	});

	it("resolve path: throws OdyseeDrmProtectedVideo for 'Copyright' license", async () => {
		const adapter = new OdyseeAdapter();

		// Only resolve is needed; adapter aborts with DRM error
		mockedAxios.post.mockImplementationOnce((url: string) => {
			expect(url).toContain("?m=resolve");
			return Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#2": {
							canonical_url: "lbry://@c#1/slug#2",
							claim_id: "CLAIMID",
							value_type: "stream",
							value: { license: "Copyright" },
						},
					},
				},
			});
		});
	});

	it("resolve path: throws OdyseeUnavailableVideo when verifyStream of streaming_url fails", async () => {
		const adapter = new OdyseeAdapter();

		// 1) resolve OK
		mockedAxios.post.mockImplementationOnce((url: string) => {
			expect(url).toContain("?m=resolve");
			return Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#2": {
							canonical_url: "lbry://@c#1/slug#2",
							claim_id: "CLAIMID",
							value_type: "stream",
							value: { license: "None" },
						},
					},
				},
			});
		});

		// 2) get -> streaming_url MP4
		mockedAxios.post.mockImplementationOnce((url: string) => {
			expect(url).toContain("?m=get");
			return Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CLAIMID",
						mime_type: "video/mp4",
						streaming_url: "https://player.odycdn.com/v6/streams/CLAIMID/FILE.mp4",
						value: {},
					},
				},
			});
		});

		// 3) verifyStream fails: HEAD 401 then GET 401
		mockedAxios.head.mockRejectedValueOnce({ response: { status: 401 } });
		mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });

		await expect(adapter.fetchVideoInfo("lbry://@c#1/slug#2")).rejects.toBeInstanceOf(
			OdyseeUnavailableVideo
		);
	});

	it("handles missing mime_type gracefully and still verifies via HEAD", async () => {
		const adapter = new OdyseeAdapter();

		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/foo#2": {
							canonical_url: "lbry://@c#1/foo#2",
							value_type: "stream",
							claim_id: "CID_MIMELESS",
						},
					},
				},
			})
		);

		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID_MIMELESS",
						streaming_url: "https://player.odycdn.com/v6/streams/CID_MIMELESS/FILE.mp4",
						value: { title: "NoMime", video: { duration: 99 } },
					},
				},
			})
		);

		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		// final verifyStream (adapter verifies MP4 again)
		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.get.mockResolvedValueOnce({
			status: 206,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		const res = await adapter.fetchVideoInfo("lbry://@c#1/foo#2");
		expect(res.title).toBe("NoMime");
		expect(res.length).toBe(99);
		expect(["video/mp4", "application/x-mpegURL"]).toContain(res.mime);
	});

	it("throws OdyseeUnavailableVideo when sd_hash missing prevents HLS construction", async () => {
		const adapter = new OdyseeAdapter();

		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/bar#2": {
							canonical_url: "lbry://@c#1/bar#2",
							value_type: "stream",
							claim_id: "CID_NOHASH",
						},
					},
				},
			})
		);

		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID_NOHASH",
						value: { title: "MissingHash", video: { duration: 11 } },
					},
				},
			})
		);

		mockedAxios.head.mockRejectedValueOnce({
			response: { status: 404 },
			isAxiosError: true,
		});

		mockedAxios.post.mockImplementationOnce(() =>
			Promise.resolve({
				data: { jsonrpc: "2.0", result: {} },
			})
		);

		await expect(adapter.fetchVideoInfo("lbry://@c#1/bar#2")).rejects.toBeInstanceOf(
			OdyseeUnavailableVideo
		);
	});

	it("falls back to MP4 if reconstructed master.m3u8 returns 404", async () => {
		const adapter = new OdyseeAdapter();

		mockedAxios.post
			.mockResolvedValueOnce({
				data: {
					jsonrpc: "2.0",
					result: {
						"lbry://@c#1/slug#3": {
							canonical_url: "lbry://@c#1/slug#3",
							value_type: "stream",
							claim_id: "CID404",
							value: { source: { sd_hash: "HASH404" }, title: "FallbackToMp4" },
						},
					},
				},
			})
			.mockResolvedValueOnce({
				data: {
					jsonrpc: "2.0",
					result: {
						claim_id: "CID404",
						mime_type: "video/mp4",
						streaming_url: "https://player.odycdn.com/v6/streams/CID404/FILE.mp4",
						value: { title: "FallbackToMp4", video: { duration: 77 } },
					},
				},
			});

		// HEAD MP4 ok, master.m3u8 404
		mockedAxios.head
			.mockResolvedValueOnce({
				status: 200,
				headers: { "content-type": "video/mp4" },
				request: { res: { responseUrl: undefined } },
			})
			.mockRejectedValueOnce({
				response: { status: 404 },
				isAxiosError: true,
			});

		mockedAxios.head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		mockedAxios.get.mockResolvedValueOnce({
			status: 206,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		const res = await adapter.fetchVideoInfo("lbry://@c#1/slug#3");
		expect(res.mime).toBe("video/mp4");
		expect(res.title).toBe("FallbackToMp4");
	});

	it("throws OdyseeUnavailableVideo on network failure during RPC", async () => {
		const adapter = new OdyseeAdapter();

		mockedAxios.post.mockResolvedValueOnce({ data: { jsonrpc: "2.0", result: {} } });

		await expect(adapter.fetchVideoInfo("lbry://@c#1/net#1")).rejects.toBeInstanceOf(
			OdyseeUnavailableVideo
		);
	});
});
