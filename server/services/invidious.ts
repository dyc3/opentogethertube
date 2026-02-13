import axios from "axios";
import maxBy from "lodash/maxBy.js";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { Parser as M3U8Parser } from "m3u8-parser";
import { DashMPD } from "@liveinstantly/dash-mpd-parser";
import { conf } from "../ott-config.js";
import type { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { InvalidVideoIdException, UpstreamInvidiousException } from "../exceptions.js";
import storage from "../storage.js";

const log = getLogger("invidious");

export const INVIDIOUS_SHORT_WATCH_RE = /^\/w\/[A-Za-z0-9_-]+$/;

interface InvidiousFormat {
	itag?: number;
	url: string;
	type?: string;
	container?: string;
	qualityLabel?: string;
	bitrate?: number;
	audioQuality?: string;
}

interface InvidiousApiVideo {
	title: string;
	author?: string;
	description?: string;
	shortDescription?: string;
	lengthSeconds: number | string;
	// Some instances expose one or both fields below:
	hlsUrl?: string;
	dashUrl?: string;
	formatStreams?: InvidiousFormat[];
	adaptiveFormats?: InvidiousFormat[];
	videoThumbnails?: { url: string; width?: number; height?: number }[];
}

// Prefer higher resolution much more than bitrate when scoring progressive formats.
// Keeping as a constant makes intent clear and avoids magic numbers in the hot path.
const SCORE_RES_WEIGHT = 1_000_000;

// Keep HTTP calls from hanging forever in CI/Docker; safe, conservative default.
// set to 15 seconds
const DEFAULT_HTTP_TIMEOUT_MS = 15000;

/**
 * Known YouTube itag→MIME hints for *progressive* formats.
 * These mappings are based on long-standing community reverse-engineering and are **not**
 * officially documented by Google/YouTube. They can change at any time and should be treated
 * as best-effort hints rather than a stable contract.
 *
 * References (non-official, community-maintained):
 * - Community iTag cheat-sheet (historical):
 *   https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2
 *
 * Keep this list intentionally small and conservative to avoid over-fitting to unstable details.
 */
const ITAG_TO_MIME = new Map<number, string>([
	[18, "video/mp4"], // 360p
	[22, "video/mp4"], // 720p
	[59, "video/mp4"], // 480p
	[43, "video/webm"], // 360p (VP8/Vorbis)
	[44, "video/webm"], // 480p
	[45, "video/webm"], // 720p
]);

export default class InvidiousAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {
			"User-Agent": `OpenTogetherTube-InvidiousServiceAdapter @ ${conf.get("hostname")}`,
		},
		timeout: DEFAULT_HTTP_TIMEOUT_MS,
	});

	allowedHosts: string[] = [];

	get serviceId(): VideoService {
		return "invidious";
	}

	get isCacheSafe(): boolean {
		return true;
	}

	async initialize(): Promise<void> {
		this.allowedHosts = conf.get("info_extractor.invidious.instances");
		log.info(`Invidious adapter enabled. Instances: ${this.allowedHosts.join(", ")}`);
	}

	canHandleURL(link: string): boolean {
		let url: URL;
		try {
			url = new URL(link);
		} catch {
			return false;
		}
		// Only accept http(s) schemes to avoid false positives (e.g., mailto:, chrome:).
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return false;
		}
		// Accept either "host" (may include :port) or "hostname" from config.
		const hostAllowed =
			this.allowedHosts.includes(url.host) || this.allowedHosts.includes(url.hostname);
		if (!hostAllowed) {
			return false;
		}
		// Support both the canonical and short Invidious routes that mirror YouTube. – Invidious-specific
		if (url.pathname === "/watch") {
			return url.searchParams.has("v");
		}
		return INVIDIOUS_SHORT_WATCH_RE.test(url.pathname);
	}

	isCollectionURL(_link: string): boolean {
		// Playlists/Channels – not supported
		return false;
	}

	getVideoId(link: string): string {
		// Be defensive: surface a consistent domain-specific error on bad inputs.
		let url: URL;
		try {
			url = new URL(link);
		} catch {
			throw new InvalidVideoIdException(this.serviceId, link);
		}
		let id: string | null = null;

		if (url.pathname === "/watch") {
			id = url.searchParams.get("v");
		} else if (INVIDIOUS_SHORT_WATCH_RE.test(url.pathname)) {
			id = url.pathname.split("/").pop() || null;
		}

		if (!id) {
			throw new InvalidVideoIdException(this.serviceId, link);
		}
		return `${url.host}:${id.trim()}`;
	}

	/**
	 * Build proxied manifest URL via the instance.
	 * `local=1` forces the instance to proxy YouTube instead of redirecting, which adds permissive CORS headers.
	 * This is required because browsers cannot fetch YouTube manifests cross-origin directly. – Browser+CORS / Invidious behavior
	 */
	private manifestUrl(host: string, id: string, type: "hls" | "dash"): string {
		const u = new URL(`https://${host}/api/manifest/${type}/id/${encodeURIComponent(id)}`);
		u.searchParams.set("local", "1");
		// Some instances honor `source=youtube` to disambiguate backends. – Invidious-specific
		u.searchParams.set("source", "youtube");
		return u.toString();
	}

	async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		// Split on the *last* colon so hosts with ports (e.g., example.com:8443) are preserved.
		const sep = videoId.lastIndexOf(":");
		if (sep === -1) {
			throw new InvalidVideoIdException(this.serviceId, videoId);
		}
		const host = videoId.slice(0, sep);
		const id = videoId.slice(sep + 1);
		const baseUrl = `https://${host}/api/v1/videos/${encodeURIComponent(id)}`;
		let data: InvidiousApiVideo | undefined;
		// Try proxied (?local=1) first; on failure, fall back to plain endpoint.
		// If upstream returns an HTTP error (e.g. 429), convert to a FE-visible exception
		// instead of bubbling up as a generic 500.
		try {
			const resLocal = await this.api.get<InvidiousApiVideo>(`${baseUrl}?local=1`, {
				headers: { Accept: "application/json" },
			});
			data = resLocal.data;
		} catch (e: any) {
			if (axios.isAxiosError(e) && e.response) {
				const status = e.response.status;
				if (status === 429) {
					// Short-circuit on rate limit to provide a clear UI message.
					throw new UpstreamInvidiousException({
						host,
						status,
						endpoint: `${baseUrl}?local=1`,
					});
				}
			}
			// Some instances gate `local=1`; try non-proxied metadata next.
			try {
				const res = await this.api.get<InvidiousApiVideo>(baseUrl, {
					headers: { Accept: "application/json" },
				});
				data = res.data;
			} catch (e2: any) {
				if (axios.isAxiosError(e2)) {
					// HTTP error from upstream (e.g., 429/5xx)
					if (e2.response) {
						throw new UpstreamInvidiousException({
							host,
							status: e2.response.status,
							endpoint: baseUrl,
						});
					}
					// Network / timeout (no response): keep it simple — Axios uses ECONNABORTED for timeouts.
					const isTimeout = e2.code === "ECONNABORTED";
					throw new UpstreamInvidiousException({
						host,
						status: isTimeout ? 504 : 502,
						endpoint: baseUrl,
					});
				}
				// Unknown error type — wrap conservatively as upstream error (Bad Gateway)
				throw new UpstreamInvidiousException({
					host,
					status: 502,
					endpoint: baseUrl,
				});
			}
		}

		if (!data?.title) {
			// Empty/invalid JSON: surface a 502 with user-friendly message.
			throw new UpstreamInvidiousException({
				host,
				status: 502,
				endpoint: `${baseUrl} (empty/invalid)`,
			});
		}

		// Prefer DASH/HLS (higher quality) and fall back to progressive "direct"
		const video = await this.parseAsDirect(data, host, id);

		// Pre-fill cache to avoid a later HEAD/probe by the DirectVideoAdapter that might be blocked by CORS
		// or upstream shields on public instances. – Browser+CORS / Invidious infra
		try {
			await storage.updateVideoInfo(video);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			log.warn(`Failed to prefill cache for ${video.service}:${video.id}: ${msg}`);
		}
		return video;
	}

	/** Proxied Progressive (MP4/WebM) over Invidious – avoids YouTube signature churn and ensures CORS-compatible URLs. – YouTube+Invidious behavior */
	private proxiedProgressive(host: string, id: string, itag?: number) {
		const u = new URL(`https://${host}/latest_version`);
		u.searchParams.set("id", id);
		if (itag) {
			u.searchParams.set("itag", String(itag));
		}
		u.searchParams.set("local", "1");
		// Helps some instances route the request correctly. – Invidious-specific
		u.searchParams.set("source", "youtube");
		return u.toString();
	}

	private pickBestThumbnail(
		thumbnails?: { url: string; width?: number; height?: number }[]
	): string | undefined {
		// Prefer the thumbnail with the largest pixel area.
		if (!thumbnails?.length) {
			return undefined;
		}
		const best = maxBy(thumbnails, t => (t.width ?? 0) * (t.height ?? 0));
		return best?.url;
	}

	private async parseAsDirect(inv: InvidiousApiVideo, host: string, id: string): Promise<Video> {
		const rawDesc = (inv.description ?? inv.shortDescription ?? "").toString().trim();
		const safeDesc = rawDesc.length ? rawDesc : inv.title;

		const base = {
			title: inv.title,
			description: safeDesc,
			length:
				typeof inv.lengthSeconds === "string"
					? parseInt(inv.lengthSeconds, 10)
					: inv.lengthSeconds,
			thumbnail: this.pickBestThumbnail(inv.videoThumbnails),
		};

		// 1) Probe DASH & HLS and pick the manifest whose top variant has the higher bitrate.
		try {
			// Promise.any would give only the first fulfilled result and drop the second one, which prevents comparing topKbps when both succeed.
			const [dashSet, hlsSet] = await Promise.allSettled([
				this.probeManifest(host, id, "dash"),
				this.probeManifest(host, id, "hls"),
			]);
			const dashProbe = dashSet.status === "fulfilled" ? dashSet.value : null;
			const hlsProbe = hlsSet.status === "fulfilled" ? hlsSet.value : null;
			const pick =
				dashProbe && hlsProbe
					? dashProbe.topKbps >= hlsProbe.topKbps
						? dashProbe
						: hlsProbe
					: dashProbe ?? hlsProbe;
			if (pick) {
				log.debug("Picked streaming manifest", {
					kind: pick.kind,
					url: pick.url,
					topKbps: pick.topKbps,
					topRes: pick.topRes,
				});
				if (pick.kind === "dash") {
					return {
						service: "dash",
						id: pick.url,
						...base,
						dash_url: pick.url,
						mime: "application/dash+xml", // Some downstream codepaths expect a MIME hint even though dash.js can infer. – Pipeline/browser integration
					};
				} else {
					return {
						service: "hls",
						id: pick.url,
						...base,
						hls_url: pick.url,
						// Mimetype application/vnd.apple.mpegurl not supported by plyrplayer so switching to x-mpegURL
						mime: "application/x-mpegURL",
					};
				}
			}
		} catch (e) {
			log.warn(`DASH/HLS probing failed for ${host}:${id}, will try progressive.`, {
				err: e instanceof Error ? e.message : e,
			});
		}

		// 2) Progressive fallback (MP4/WebM with audio) via /latest_version
		// Direct YouTube progressive URLs are short-lived and CORS-restricted; proxying via Invidious stabilizes access for browsers. – YouTube+CORS
		// Helper to extract numeric quality from labels like "720p", "480p", etc.
		const q = (label?: string) => {
			const m = (label || "").match(/(\d+)/);
			return m ? parseInt(m[1], 10) : 0;
		};

		const list = (inv.formatStreams || []).filter(f => !!f.url);
		if (list.length) {
			const mp4 = list.filter(
				f => f.container === "mp4" || (f.type || "").toLowerCase().includes("mp4")
			);

			// Use the constant (no magic number) and avoid non-null assertion by falling back to list[0].
			const score = (f: InvidiousFormat) =>
				q(f.qualityLabel) * SCORE_RES_WEIGHT + (f.bitrate || 0);
			const bestMp4 = maxBy(mp4, score); // InvidiousFormat | undefined
			const bestAny = maxBy(list, score) ?? list[0];
			const chosen = bestMp4 ?? bestAny;

			// Infer MIME from container/type; Invidious does not always expose full codec/MIME details for YouTube progressive formats. – Invidious/YouTube issue
			let mime =
				chosen.type?.split(";")[0]?.trim() ||
				(chosen.container === "webm"
					? "video/webm"
					: chosen.container === "mp4"
					? "video/mp4"
					: undefined);
			// Always proxy via the instance (avoids CORS/signature churn) and carry itag if known.
			const proxied = this.proxiedProgressive(host, id, chosen.itag);

			// If MIME cannot be inferred reliably, prefer MP4 for widest browser compatibility. – Browser compatibility
			if (!mime) {
				const m =
					typeof chosen.itag === "number" ? ITAG_TO_MIME.get(chosen.itag) : undefined;
				mime = m ?? "video/mp4";
			}
			log.info("Chosen progressive stream via /latest_version", {
				host,
				id,
				itag: chosen.itag,
				label: chosen.qualityLabel,
				container: chosen.container,
				bitrate: chosen.bitrate,
				mime,
			});
			return { service: "direct", id: proxied, ...base, mime };
		}
		// Fallback: let the instance pick a default via /latest_version (proxied)
		const fallback = this.proxiedProgressive(host, id);
		// Some videos only expose adaptive (DASH/HLS) and no progressive tracks. – YouTube encoding variability
		log.warn("No progressive formatStreams found; falling back to proxied /latest_version", {
			host,
			id,
		});
		return {
			service: "direct",
			id: fallback,
			...base,
			mime: "video/mp4",
		};
	}
	/** Probe a manifest and return its top bitrate/resolution.
	 * Parse MPD/M3U8 using dedicated parsers; regex is unreliable because these manifests evolve frequently across YouTube encodes and Invidious rewrites. – YouTube/HLS/DASH variability
	 */
	private async probeManifest(
		host: string,
		id: string,
		kind: "dash" | "hls"
	): Promise<{ kind: "dash" | "hls"; url: string; topKbps: number; topRes?: string } | null> {
		const url = this.manifestUrl(host, id, kind);
		try {
			const resp = await this.api.get<string>(url, {
				headers: {
					Accept:
						kind === "dash"
							? "application/dash+xml,text/plain;q=0.9,*/*;q=0.8"
							: "application/vnd.apple.mpegurl,application/x-mpegURL,text/plain;q=0.9,*/*;q=0.8",
					// timeout inherited from axios instance (DEFAULT_HTTP_TIMEOUT_MS)
				},
				responseType: "text",
				transformResponse: [r => r],
			});
			const text = typeof resp.data === "string" ? resp.data : String(resp.data);
			if (kind === "dash") {
				// Parse DASH MPD using the dedicated library (no dynamic regex).
				// Code-owner request: avoid ad-hoc regex and rely on structured parsing.
				let topBw = 0;
				let topRes: string | undefined;

				const mpd = new DashMPD();
				mpd.parse(text);

				// The library exposes a JSON-like structure; normalize variants across versions.
				const asArr = <T>(v: T | T[] | undefined | null): T[] =>
					Array.isArray(v) ? v : v !== null && v !== undefined ? [v as T] : [];
				const attrs = (node: any): Record<string, unknown> =>
					(node && (node["@"] ?? node._attributes ?? node.attributes ?? node.$)) || {};

				const root: any =
					(mpd as any).mpd?.MPD ??
					(mpd as any).mpd ??
					mpd.getJSON?.().MPD ??
					mpd.getJSON?.();

				for (const period of asArr(root?.Period)) {
					for (const set of asArr(period?.AdaptationSet)) {
						for (const rep of asArr(set?.Representation)) {
							const a = attrs(rep);
							const bw = Number(a["bandwidth"] ?? a["Bandwidth"] ?? 0);
							if (!Number.isFinite(bw) || bw <= topBw) {
								continue;
							}
							topBw = bw;
							const w = Number(a["width"] ?? a["Width"]);
							const h = Number(a["height"] ?? a["Height"]);
							if (Number.isFinite(w) && Number.isFinite(h)) {
								topRes = `${w}x${h}`;
							}
						}
					}
				}

				// Conservative fallback: fixed-pattern scan for attributes if parser yielded no bandwidth.
				// Note: avoids *dynamic* regex; only checks well-known attribute names.
				if (topBw === 0) {
					// Find <Representation .../> tags and extract bandwidth/width/height via fixed regexes.
					const repTagRe = /<Representation\b[^>]*\/?>/gi;
					const bwRe = /(?:^|\s)bandwidth\s*=\s*["'](\d+)["']/i;
					const wRe = /(?:^|\s)width\s*=\s*["'](\d+)["']/i;
					const hRe = /(?:^|\s)height\s*=\s*["'](\d+)["']/i;
					let m: RegExpExecArray | null;
					while ((m = repTagRe.exec(text)) !== null) {
						const tag = m[0];
						const bwMatch = bwRe.exec(tag);
						if (!bwMatch) {
							continue;
						}
						const bw = Number(bwMatch[1]);
						if (!Number.isFinite(bw) || bw <= topBw) {
							continue;
						}
						topBw = bw;
						// Resolution is optional; capture if present.
						const wMatch = wRe.exec(tag);
						const hMatch = hRe.exec(tag);
						const w = wMatch ? Number(wMatch[1]) : NaN;
						const h = hMatch ? Number(hMatch[1]) : NaN;
						if (Number.isFinite(w) && Number.isFinite(h)) {
							topRes = `${w}x${h}`;
						}
					}
				}

				return { kind: "dash" as const, url, topKbps: Math.round(topBw / 1000), topRes };
			} else {
				// Parse HLS master playlist via m3u8-parser; master formats differ across encodes and instance rewrites. – YouTube/Invidious variability
				const parser = new M3U8Parser();
				parser.push(text);
				parser.end();
				const manifest: any = parser.manifest || {};
				const playlists: any[] = manifest.playlists || [];
				let topBw = 0;
				let topRes: string | undefined;
				for (const pl of playlists) {
					const attrs = pl?.attributes || {};
					const bw = Number(attrs.BANDWIDTH || 0);
					if (bw > topBw) {
						topBw = bw;
						const res = attrs.RESOLUTION;
						if (res?.width && res?.height) {
							topRes = `${res.width}x${res.height}`;
						} else {
							topRes = undefined;
						}
					}
				}
				return { kind: "hls" as const, url, topKbps: Math.round(topBw / 1000), topRes };
			}
		} catch (e) {
			// Public instances may throttle or shield manifest endpoints (e.g., 421/429/5xx behind DDoS protection). – Invidious/infra behavior
			log.warn(`probeManifest failed`, {
				kind,
				url,
				error: e instanceof Error ? e.message : e,
			});
			return null;
		}
	}
}
