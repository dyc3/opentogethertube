import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- axios mock that routes by JSON-RPC method name and by HTTP verb ---
vi.mock("axios", () => {
	// one shared instance returned by axios.create()
	const instance = {
		head: vi.fn(),
		get: vi.fn(),
		post: vi.fn(),
	};

	const rpcHandlers: Record<string, (params: any) => any> = {};
	const setRpc = (method: string, handler: (params: any) => any) => {
		rpcHandlers[method] = handler;
	};
	const clearRpc = () => {
		for (const k of Object.keys(rpcHandlers)) {
			delete rpcHandlers[k];
		}
	};

	const post = vi.fn(async (url: string, body?: any) => {
		if (typeof url === "string" && url.includes("?m=auth_get")) {
			return { data: { jsonrpc: "2.0", result: { auth_token: "TEST_TOKEN" } }, headers: {} };
		}
		if (body && typeof body === "object" && body.method) {
			const m = String(body.method);
			const fn = rpcHandlers[m];
			if (!fn) {
				return { data: { jsonrpc: "2.0", result: {} } };
			}
			const result = await fn(body.params ?? {});
			return { data: { jsonrpc: "2.0", result } };
		}
		return { data: { jsonrpc: "2.0", result: {} } };
	});

	const create = vi.fn(() => ({ head: instance.head, get: instance.get, post }));
	const isAxiosError = (e: unknown) => Boolean(e && typeof e === "object" && (e as any).response);

	return {
		default: {
			...instance,
			create,
			post,
			isAxiosError,
			__rpcSet: setRpc,
			__rpcClear: clearRpc,
		},
	};
});

import axios from "axios";
import OdyseeAdapter from "../../../services/odysee.js";
import { OdyseeUnavailableVideo } from "../../../exceptions.js";

type AxiosWithHelpers = typeof axios & {
	__rpcSet: (m: string, fn: (p: any) => any) => void;
	__rpcClear: () => void;
};
const ax = axios as unknown as AxiosWithHelpers;

describe("OdyseeAdapter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		ax.__rpcClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns HLS when precise master.m3u8 is verifiable (resolve -> get -> HEAD ok -> pickBestHlsVariant)", async () => {
		const adapter = new OdyseeAdapter();

		ax.__rpcSet("resolve", ({ urls }) => {
			const key = urls?.[0];
			return {
				[key]: {
					canonical_url: key,
					value_type: "stream",
					claim_id: "CLAIMID",
					value: {
						title: "Foo",
						source: { sd_hash: "SDHASH" },
						video: { duration: 123 },
					},
				},
			};
		});

		ax.__rpcSet("get", () => ({
			claim_id: "CLAIMID",
			mime_type: "video/mp4",
			streaming_url: "https://player.odycdn.com/v6/streams/CLAIMID/file.mp4",
			value: { title: "Foo", source: { sd_hash: "SDHASH" }, video: { duration: 123 } },
		}));

		(axios as any).head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		(axios as any).head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "application/vnd.apple.mpegurl" },
			request: { res: { responseUrl: undefined } },
		});

		(axios as any).head.mockResolvedValueOnce({
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

	it("falls back to MP4 when HLS reconstruction 404s", async () => {
		const adapter = new OdyseeAdapter();

		ax.__rpcSet("resolve", ({ urls }) => {
			const key = urls?.[0];
			return {
				[key]: {
					canonical_url: key,
					value_type: "stream",
					claim_id: "CID404",
					value: {
						title: "FallbackToMp4",
						source: { sd_hash: "HASH404" },
						video: { duration: 77 },
					},
				},
			};
		});

		ax.__rpcSet("get", () => ({
			claim_id: "CID404",
			mime_type: "video/mp4",
			streaming_url: "https://player.odycdn.com/v6/streams/CID404/FILE.mp4",
			value: {
				title: "FallbackToMp4",
				video: { duration: 77 },
				source: { sd_hash: "HASH404" },
			},
		}));

		(axios as any).head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		(axios as any).head.mockRejectedValueOnce({
			response: { status: 404 },
			isAxiosError: true,
		});

		(axios as any).get.mockRejectedValueOnce({
			response: { status: 404 },
		});

		(axios as any).head.mockRejectedValueOnce({
			response: { status: 404 },
			isAxiosError: true,
		});

		(axios as any).get.mockRejectedValueOnce({
			response: { status: 404 },
		});

		(axios as any).head.mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		(axios as any).get.mockResolvedValueOnce({
			status: 206,
			headers: { "content-type": "video/mp4" },
			request: { res: { responseUrl: undefined } },
		});

		const res = await adapter.fetchVideoInfo("lbry://@c#1/slug#3");
		expect(res.mime).toBe("video/mp4");
		expect(res.title).toBe("FallbackToMp4");
	});

	it("throws OdyseeUnavailableVideo when resolve returns no entry", async () => {
		const adapter = new OdyseeAdapter();

		ax.__rpcSet("resolve", () => ({}));

		await expect(adapter.fetchVideoInfo("lbry://@c#1/net#1")).rejects.toBeInstanceOf(
			OdyseeUnavailableVideo
		);
	});

	it("surfaces CDN text error from 401 (if present) OR uses default message", async () => {
		const adapter = new OdyseeAdapter();

		ax.__rpcSet("resolve", ({ urls }) => {
			const key = urls?.[0];
			return {
				[key]: {
					canonical_url: key,
					value_type: "stream",
					claim_id: "CID401",
					value: {
						title: "BlockedVideo",
						source: { sd_hash: "SDHASH401" },
						video: { duration: 33 },
					},
				},
			};
		});

		ax.__rpcSet("get", () => ({
			claim_id: "CID401",
			streaming_url: "https://player.odycdn.com/v6/streams/CID401/SDHASH401.mp4",
			value: {
				title: "BlockedVideo",
				source: { sd_hash: "SDHASH401" },
				video: { duration: 33 },
			},
		}));

		(axios as any).head.mockRejectedValueOnce({
			response: { status: 401, data: "this content cannot be accessed at the moment" },
		});

		(axios as any).get.mockRejectedValueOnce({
			response: { status: 401, data: "this content cannot be accessed at the moment" },
		});

		let err: unknown;
		try {
			await adapter.fetchVideoInfo("lbry://@test#1/video#2");
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(OdyseeUnavailableVideo);

		const msg = (err as any).userMessage ?? (err as any).message ?? "";
		expect(typeof msg).toBe("string");
		expect(
			/this content cannot be accessed at the moment/i.test(msg) || /not available/i.test(msg)
		).toBe(true);
	});
});
