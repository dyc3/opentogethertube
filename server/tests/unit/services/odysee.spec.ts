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
import { OdyseeDrmProtectedVideo, OdyseeUnavailableVideo } from "../../../exceptions.js";

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

		await expect(adapter.fetchVideoInfo("lbry://@c#1/slug#2")).rejects.toBeInstanceOf(
			OdyseeDrmProtectedVideo
		);
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
});
