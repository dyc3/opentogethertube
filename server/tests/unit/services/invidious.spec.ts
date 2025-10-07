import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidVideoIdException, UpstreamInvidiousException } from "../../../exceptions.js";
import InvidiousAdapter, { INVIDIOUS_SHORT_WATCH_RE } from "../../../services/invidious.js";

describe("InvidiousAdapter (unit)", () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	describe("INVIDIOUS_SHORT_WATCH_RE", () => {
		it("accepts /w/<id> with letters, digits, _ and -", () => {
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abcDEF123_-")).toBe(true);
		});

		it("accepts IDs longer than 11 chars (no strict length)", () => {
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abcdefghijklmnop")).toBe(true);
		});

		it("rejects when trailing slash is present", () => {
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc123/")).toBe(false);
		});

		it("rejects when illegal chars are present", () => {
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc.123")).toBe(false);
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc+123")).toBe(false);
			expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/")).toBe(false);
		});
	});

	describe("InvidiousAdapter URL handling", () => {
		const mk = (u: string) => u; // small helper to keep strings readable
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			// Restrict to a known host so tests are deterministic
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		describe("canHandleURL", () => {
			it("rejects invalid URL strings defensively", () => {
				// Should not throw; just return false when URL parsing fails.
				expect(adapter.canHandleURL("not a url")).toBe(false);
			});

			it("rejects non-http(s) schemes", () => {
				// Defensive: should not accept mailto:, chrome:, etc.
				expect(adapter.canHandleURL("mailto:test@example.com")).toBe(false);
			});

			it("accepts allowed hostname even when URL includes a port", () => {
				// The implementation accepts either exact host or hostname (without port).
				expect(adapter.canHandleURL(mk("https://inv.nadeko.net:8443/watch?v=abc123"))).toBe(
					true
				);
			});
			it("accepts /watch?v=VIDEOID on allowed host", () => {
				expect(adapter.canHandleURL(mk("https://inv.nadeko.net/watch?v=abc123"))).toBe(
					true
				);
			});

			it("accepts /watch?v=VIDEOID with extra params", () => {
				expect(
					adapter.canHandleURL(mk("https://inv.nadeko.net/watch?v=abc123&t=42s&foo=bar"))
				).toBe(true);
			});

			it("accepts /w/VIDEOID on allowed host", () => {
				expect(adapter.canHandleURL(mk("https://inv.nadeko.net/w/abc123"))).toBe(true);
			});

			it("accepts /w/ with >11 length ID", () => {
				expect(
					adapter.canHandleURL(mk("https://inv.nadeko.net/w/abcdefghijklmnop_qwerty-XYZ"))
				).toBe(true);
			});

			it("rejects unknown host even if path matches", () => {
				expect(adapter.canHandleURL(mk("https://other.com/w/abc123"))).toBe(false);
				expect(adapter.canHandleURL(mk("https://other.com/watch?v=abc123"))).toBe(false);
			});

			it("rejects /watch without v param", () => {
				expect(adapter.canHandleURL(mk("https://inv.nadeko.net/watch"))).toBe(false);
			});

			it("rejects /w/ with invalid chars", () => {
				expect(adapter.canHandleURL(mk("https://inv.nadeko.net/w/abc.123"))).toBe(false);
			});
		});

		describe("getVideoId", () => {
			it("extracts host:id from /watch?v=ID", () => {
				const id = adapter.getVideoId(mk("https://inv.nadeko.net/watch?v=abc123_-"));
				expect(id).toBe("inv.nadeko.net:abc123_-");
			});

			it("extracts host:id from /w/ID", () => {
				const id = adapter.getVideoId(mk("https://inv.nadeko.net/w/AbC-123_"));
				expect(id).toBe("inv.nadeko.net:AbC-123_");
			});

			it("throws a domain-specific error on invalid URL input", () => {
				// Be defensive: invalid URL strings should surface as InvalidVideoIdException.
				expect(() => adapter.getVideoId("not a url")).toThrow(InvalidVideoIdException);
			});

			it("throws on missing id", () => {
				expect(() => adapter.getVideoId(mk("https://inv.nadeko.net/watch"))).toThrow(
					InvalidVideoIdException
				);
				expect(() => adapter.getVideoId(mk("https://inv.nadeko.net/w/"))).toThrow(
					InvalidVideoIdException
				);
			});
		});

		describe("isCollectionURL", () => {
			it("returns false for non-collection URLs by design", () => {
				expect(adapter.isCollectionURL("https://inv.nadeko.net/watch?v=abc")).toBe(false);
			});
		});
	});

	describe("probeManifest parsing", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		it("parses DASH MPD (via DashMPD) and returns top bitrate/res", async () => {
			const mpd = `
<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:DASH:schema:MPD:2011"
     profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="static"
     minBufferTime="PT2S"
     mediaPresentationDuration="PT10S">
  <Period>
    <AdaptationSet mimeType="video/mp4" contentType="video">
      <Representation id="1080"
                      bandwidth="4300000"
                      width="1920"
                      height="1080"/>
      <Representation id="720"
                      bandwidth="2100000"
                      width="1280"
                      height="720"/>
    </AdaptationSet>
  </Period>
</MPD>`;
			// mock axios instance on this adapter (DashMPD expects raw XML string)
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						(adapter.api.get as any) = vi.fn().mockResolvedValue({ data: mpd, headers: {} });

			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			const out = await (adapter as any).probeManifest("inv.nadeko.net", "abc", "dash");
			// Assert fields individually to avoid matcher differences
			expect(out).not.toBeNull();
			// Kind must be "dash"
			expect(out?.kind).toBe("dash");
			// URL should include the DASH manifest path (query order may vary)
			expect(out?.url).toContain("/api/manifest/dash/id/abc");
			// And the proxy parameters we rely on for CORS stability
			expect(out?.url).toContain("local=1");
			expect(out?.url).toContain("source=youtube");
			// Top bitrate should be 4300 kbps for the 4,300,000 bandwidth rep
			expect(out?.topKbps).toBe(4300);
			// Resolution should be 1920x1080 (width/height present in the test MPD)
			expect(out?.topRes).toBe("1920x1080");
		});

		it("parses HLS master and returns top bitrate/res", async () => {
			const m3u = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4200000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
hi.m3u8
`;
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			(adapter.api.get as any) = vi.fn().mockResolvedValue({ data: m3u, headers: {} });

			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			const out = await (adapter as any).probeManifest("inv.nadeko.net", "abc", "hls");
			expect(out).toEqual({
				kind: "hls",
				url: expect.stringContaining("/api/manifest/hls/id/abc"),
				topKbps: 4200,
				topRes: "1920x1080",
			});
			// Also ensure the proxy parameters are present
			expect(out?.url).toContain("local=1");
			expect(out?.url).toContain("source=youtube");
		});
	});

	describe("fetchVideoInfo: host with explicit port", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			// allow the base hostname (port may be present in the URL string)
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		it("preserves the port from the videoId when building the API URL", async () => {
			// Arrange: spy parseAsDirect to avoid probing manifests and to control the return value.
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						const parseSpy = vi.spyOn(adapter as any, "parseAsDirect").mockResolvedValue({
				service: "direct",
				id: "x",
				title: "T",
				description: "T",
				length: 10,
				mime: "video/mp4",
			});

			const getMock = vi.spyOn(adapter.api, "get").mockResolvedValueOnce({
				data: { title: "T", lengthSeconds: 10 },
				headers: {},
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			} as any);

			await adapter.fetchVideoInfo("inv.nadeko.net:8443:abc");
			expect(getMock.mock.calls[0][0]).toContain(
				"https://inv.nadeko.net:8443/api/v1/videos/abc"
			);
			expect(parseSpy).toHaveBeenCalled();
		});
	});

	describe("fetchVideoInfo: chooses HLS/DASH by top bitrate", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		function mockVideoJson() {
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			(adapter.api.get as any) = vi
				.fn()
				// first call: /api/v1/videos?id&local=1
				.mockResolvedValueOnce({
					data: { title: "T", lengthSeconds: 10, formatStreams: [] },
					headers: {},
				});
			// subsequent probeManifest calls are stubbed via spy below; we won't hit api.get there
		}

		it("picks DASH when DASH topKbps > HLS", async () => {
			mockVideoJson();
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			vi.spyOn(adapter as any, "probeManifest").mockImplementation(async (...args: any[]) => {
				const kind = args[2] as "dash" | "hls";
				return kind === "dash"
					? {
							kind: "dash",
							url: "https://inv.nadeko.net/api/manifest/dash/id/abc?local=1&source=youtube",
							topKbps: 5000,
						}
					: {
							kind: "hls",
							url: "https://inv.nadeko.net/api/manifest/hls/id/abc?local=1&source=youtube",
							topKbps: 3000,
						};
			});

			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("dash");
			expect(v.dash_url).toContain("/api/manifest/dash/");
			expect(v.mime).toBe("application/dash+xml");
		});

		it("picks HLS when HLS topKbps > DASH", async () => {
			mockVideoJson();
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			vi.spyOn(adapter as any, "probeManifest").mockImplementation(async (...args: any[]) => {
				const kind = args[2] as "dash" | "hls";
				return kind === "dash"
					? {
							kind: "dash",
							url: "https://inv.nadeko.net/api/manifest/dash/id/abc?local=1&source=youtube",
							topKbps: 2000,
						}
					: {
							kind: "hls",
							url: "https://inv.nadeko.net/api/manifest/hls/id/abc?local=1&source=youtube",
							topKbps: 4000,
						};
			});

			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("hls");
			expect(v.hls_url).toContain("/api/manifest/hls/");
			expect(v.mime).toBe("application/x-mpegURL");
		});
	});
	/**
	 * New: partial probe failures should not fail the whole operation.
	 * We now use Promise.allSettled to allow one probe to fail independently.
	 */
	describe("fetchVideoInfo: partial probe failures (allSettled semantics)", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		function mockVideoJson() {
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			(adapter.api.get as any) = vi
				.fn()
				// first call: /api/v1/videos?id&local=1
				.mockResolvedValueOnce({
					data: { title: "T", lengthSeconds: 10, formatStreams: [] },
					headers: {},
				});
		}

		it("uses DASH when HLS probe rejects and DASH succeeds", async () => {
			mockVideoJson();
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			vi.spyOn(adapter as any, "probeManifest").mockImplementation(async (...args: any[]) => {
				const kind = args[2] as "dash" | "hls";
				if (kind === "dash") {
					return {
						kind: "dash",
						url: "https://inv.nadeko.net/api/manifest/dash/id/abc?local=1&source=youtube",
						topKbps: 4500,
					};
				}
				throw new Error("hls-probe-failed");
			});
			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("dash");
		});

		it("uses HLS when DASH probe rejects and HLS succeeds", async () => {
			mockVideoJson();
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
			vi.spyOn(adapter as any, "probeManifest").mockImplementation(async (...args: any[]) => {
				const kind = args[2] as "dash" | "hls";
				if (kind === "hls") {
					return {
						kind: "hls",
						url: "https://inv.nadeko.net/api/manifest/hls/id/abc?local=1&source=youtube",
						topKbps: 4200,
					};
				}
				throw new Error("dash-probe-failed");
			});
			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("hls");
		});
	});

	describe("Progressive fallback selection", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		it("prefers highest-quality progressive and falls back to MP4 MIME via itag", async () => {
			// Arrange: make probeManifest fail so we go progressive
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						vi.spyOn(adapter as any, "probeManifest").mockRejectedValue(new Error("nope"));
			// Invidious /api/v1/videos payload
			// Important: include 'url' fields so progressive selection is exercised.
			// Also: no MP4 entries present, so MIME must be derived from the iTag (22 → MP4).
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
												(adapter.api.get as any) = vi.fn().mockResolvedValueOnce({
				data: {
					title: "T",
					lengthSeconds: 10,
					// Two progressives: one WEBM 720p and one 1080p with no container/type but iTag=22 (MP4).
					// This forces the codepath that uses the iTag mapping for MIME.
					formatStreams: [
						{
							url: "https://inv.example/video-720.webm",
							container: "webm",
							qualityLabel: "1080p",
							bitrate: 1_500_000,
							type: "video/webm",
							itag: 45,
						},
						{
							url: "https://inv.example/video-1080-unknown",
							qualityLabel: "1080p",
							bitrate: 1_800_000,
							itag: 22,
						},
					],
				},
				headers: {},
			});

			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("direct");
			expect(v.mime).toBe("video/mp4"); // via iTag mapping
			expect(v.id).toContain("/latest_version?");
			expect(v.id).toContain("itag=22");
		});
		/* New: explicit fallback when there are *no* progressive formats and probes fail.
		 * This covers the branch that returns a proxied /latest_version URL with a safe MP4 mime.
		 */
		it("falls back to /latest_version when no progressive formats and probes fail", async () => {
			// biome-ignore lint/nursery/noShadow: biome migration
			const adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];

			// Force both probes to fail so we *must* use the no-formats fallback.
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						vi.spyOn(adapter as any, "probeManifest").mockRejectedValue(new Error("probe-failed"));

			// Respond with a metadata payload that has *no* formatStreams.
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						(adapter.api.get as any) = vi.fn().mockResolvedValueOnce({
				data: {
					title: "NoFormats",
					lengthSeconds: 12,
					formatStreams: [], // <- empty list triggers latest_version fallback
				},
				headers: {},
			});

			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc123");
			expect(v.service).toBe("direct");
			expect(v.id).toContain("/latest_version");
			expect(v.mime).toBe("video/mp4");
		});
	});

	describe("fetchVideoInfo: error mapping to UpstreamInvidiousException", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		it("throws UpstreamInvidiousException on upstream 429 (rate limited) for ?local=1", async () => {
			// Arrange: first request (?local=1) returns an Axios-like 429 error.
			const axios429 = Object.assign(new Error("rate limited"), {
				isAxiosError: true,
				response: { status: 429 },
			});
			vi.spyOn(adapter.api, "get").mockRejectedValueOnce(axios429);

			// Act/Assert
			await expect(adapter.fetchVideoInfo("inv.nadeko.net:abc")).rejects.toBeInstanceOf(
				UpstreamInvidiousException
			);
		});

		it("throws UpstreamInvidiousException on network timeout during non-proxied fallback", async () => {
			// Arrange:
			// 1) First call (?local=1) fails with a non-429 upstream HTTP error (e.g., 403),
			//    which makes the adapter fall back to the non-proxied endpoint.
			const axios403 = Object.assign(new Error("blocked"), {
				isAxiosError: true,
				response: { status: 403 },
			});
			// 2) Second call (non-proxied) fails without response, simulating a timeout.
			const axiosTimeout = Object.assign(new Error("timeout exceeded"), {
				isAxiosError: true,
				code: "ECONNABORTED",
				// no 'response' on purpose
			});
			vi.spyOn(adapter.api, "get")
				.mockRejectedValueOnce(axios403) // for `${baseUrl}?local=1`
				.mockRejectedValueOnce(axiosTimeout); // for `${baseUrl}`

			// Act/Assert
			await expect(adapter.fetchVideoInfo("inv.nadeko.net:abc")).rejects.toBeInstanceOf(
				UpstreamInvidiousException
			);
		});
	});

	describe("pickBestThumbnail", () => {
		it("returns URL with most pixels", () => {
			const adapter = new InvidiousAdapter();
			// biome-ignore lint/complexity/useLiteralKeys: biome migration
			const out = adapter["pickBestThumbnail"]([
				{ url: "a.jpg", width: 120, height: 90 },
				{ url: "b.jpg", width: 640, height: 480 },
				{ url: "c.jpg", width: 320, height: 180 },
			]);
			expect(out).toBe("b.jpg");
		});
		it("returns undefined for missing or empty lists", () => {
			const adapter = new InvidiousAdapter();
			// biome-ignore lint/complexity/useLiteralKeys: biome migration
			// biome-ignore lint/suspicious/noExplicitAny: biome migration
						expect(adapter["pickBestThumbnail"](undefined as any)).toBeUndefined();
			// biome-ignore lint/complexity/useLiteralKeys: biome migration
			expect(adapter["pickBestThumbnail"]([])).toBeUndefined();
		});
	});
});
