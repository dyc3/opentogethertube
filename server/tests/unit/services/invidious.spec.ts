import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import InvidiousAdapter, { INVIDIOUS_SHORT_WATCH_RE } from "../../../services/invidious.js";
import { InvalidVideoIdException } from "../../../exceptions.js";

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
			(adapter.api.get as any) = vi.fn().mockResolvedValue({ data: mpd, headers: {} });

			const out = await (adapter as any).probeManifest("inv.nadeko.net", "abc", "dash");
			// Assert fields individually to avoid matcher differences
			expect(out).not.toBeNull();
			// Kind must be "dash"
			expect(out?.kind).toBe("dash");
			// URL should include the DASH manifest path (query order may vary)
			expect(out?.url).toContain("/api/manifest/dash/id/abc");
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
			(adapter.api.get as any) = vi.fn().mockResolvedValue({ data: m3u, headers: {} });

			const out = await (adapter as any).probeManifest("inv.nadeko.net", "abc", "hls");
			expect(out).toEqual({
				kind: "hls",
				url: expect.stringContaining("/api/manifest/hls/id/abc"),
				topKbps: 4200,
				topRes: "1920x1080",
			});
		});
	});

	describe("fetchVideoInfo: chooses HLS/DASH by top bitrate", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		function mockVideoJson() {
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

	describe("Progressive fallback selection", () => {
		let adapter: InvidiousAdapter;

		beforeEach(() => {
			adapter = new InvidiousAdapter();
			adapter.allowedHosts = ["inv.nadeko.net"];
		});

		it("prefers best MP4 by qualityLabel and falls back to mp4 MIME via itag", async () => {
			// Arrange: make probeManifest fail so we go progressive
			vi.spyOn(adapter as any, "probeManifest").mockRejectedValue(new Error("nope"));
			// Invidious /api/v1/videos payload
			(adapter.api.get as any) = vi.fn().mockResolvedValueOnce({
				data: {
					title: "T",
					lengthSeconds: 10,
					// two MP4s + one WEBM; best MP4 is 1080p
					formatStreams: [
						{
							container: "webm",
							qualityLabel: "1080p",
							bitrate: 1_500_000,
							type: "video/webm",
							itag: 45,
						},
						{
							container: "mp4",
							qualityLabel: "720p",
							bitrate: 2_200_000,
							type: "video/mp4",
							itag: 22,
						},
						{
							container: "mp4",
							qualityLabel: "1080p",
							bitrate: 1_800_000,
							/* type intentionally missing */ itag: 22,
						},
					],
				},
				headers: {},
			});

			const v = await adapter.fetchVideoInfo("inv.nadeko.net:abc");
			expect(v.service).toBe("direct");
			expect(v.mime).toBe("video/mp4"); // via itag mapping / default
			expect(v.id).toContain("/latest_version?");
		});
	});

	describe("pickBestThumbnail", () => {
		it("returns URL with most pixels", () => {
			const adapter = new InvidiousAdapter();
			const out = adapter["pickBestThumbnail"]([
				{ url: "a.jpg", width: 120, height: 90 },
				{ url: "b.jpg", width: 640, height: 480 },
				{ url: "c.jpg", width: 320, height: 180 },
			]);
			expect(out).toBe("b.jpg");
		});
	});
});
