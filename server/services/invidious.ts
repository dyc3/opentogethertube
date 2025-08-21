import axios from "axios";
import { maxBy } from "lodash";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { Parser as M3U8Parser } from "m3u8-parser";
import { DOMParser } from "@xmldom/xmldom";
import { conf } from "../ott-config.js";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { InvalidVideoIdException } from "../exceptions.js";
import storage from "../storage.js";

const log = getLogger("invidious");

const INVIDIOUS_SHORT_WATCH_RE = /^\/w\/[A-Za-z0-9_-]+$/;

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

export default class InvidiousAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {
			"User-Agent": `OpenTogetherTube-InvidiousServiceAdapter @ ${conf.get("hostname")}`,
		},
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
		const url = new URL(link);
		if (!this.allowedHosts.includes(url.host)) {
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
		const url = new URL(link);
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
		if (!videoId.includes(":")) {
			throw new InvalidVideoIdException(this.serviceId, videoId);
		}
		const [host, id] = videoId.split(":");
		const baseUrl = `https://${host}/api/v1/videos/${encodeURIComponent(id)}`;
		let data: InvidiousApiVideo | undefined;
		try {
			const resLocal = await this.api.get<InvidiousApiVideo>(`${baseUrl}?local=1`, {
				headers: { Accept: "application/json" },
			});
			data = resLocal.data;
		} catch {
      // Some instances gate `local=1` behind anti-DDoS/rate-limit checks; fallback to non-proxied metadata. – Invidious infra quirk
			const res = await this.api.get<InvidiousApiVideo>(baseUrl, {
				headers: { Accept: "application/json" },
			});
			data = res.data;
		}

		if (!data?.title) {
			throw new Error(`Invidious API returned empty/invalid response for ${host}:${id}`);
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
		if (!thumbnails || thumbnails.length === 0) {
			return undefined;
		}
    // YouTube commonly exposes multiple thumbnail sizes; prefer the largest. – YouTube behavior
		const sorted = [...thumbnails].sort((a, b) => {
			const aPixels = (a.width || 0) * (a.height || 0);
			const bPixels = (b.width || 0) * (b.height || 0);
			return bPixels - aPixels;
		});
		return sorted[0]?.url;
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
      // Both may exist or be omitted depending on upstream availability and instance config. – YouTube/Invidious variability
			const [dashProbe, hlsProbe] = await Promise.all([
				this.probeManifest(host, id, "dash"),
				this.probeManifest(host, id, "hls"),
			]);
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

			const score = (f: InvidiousFormat) => q(f.qualityLabel) * 1_000_000 + (f.bitrate || 0);
			const bestMp4 = maxBy(mp4, score);
			const bestAny = maxBy(list, score)!;
			const chosen: InvidiousFormat = bestMp4 ?? bestAny;

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

      // Known YouTube itag→MIME hints for progressive formats (historical values; may vary over time). – YouTube-specific
			const ITAG_TO_MIME: Record<number, string> = {
				18: "video/mp4", // 360p
				22: "video/mp4", // 720p
				59: "video/mp4", // 480p
				43: "video/webm", // 360p (VP8/Vorbis)
				44: "video/webm", // 480p
				45: "video/webm", // 720p
			};

			// If MIME cannot be inferred reliably, prefer MP4 for widest browser compatibility. – Browser compatibility
			if (!mime) {
				const m = typeof chosen.itag === "number" ? ITAG_TO_MIME[chosen.itag] : undefined;
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
				},
				responseType: "text",
				transformResponse: [r => r],
			});
			const text = typeof resp.data === "string" ? resp.data : String(resp.data);
			if (kind === "dash") {
				// Parse MPD via xmldom (server-side safe; no browser DOM in Node). – Environment constraint
				type XmlEl = { getAttribute(name: string): string | null };
				const doc = new DOMParser().parseFromString(text, "application/xml");
				const reps: XmlEl[] = Array.from(doc.getElementsByTagName("Representation") as any);
				let topBw = 0;
				let topRes: string | undefined;
				for (const rep of reps) {
					const bwAttr = rep.getAttribute("bandwidth");
					const bw = bwAttr ? parseInt(bwAttr, 10) : 0;
					if (!bw || Number.isNaN(bw)) {
						continue;
					}
					if (bw > topBw) {
						topBw = bw;
						const wAttr = rep.getAttribute("width");
						const hAttr = rep.getAttribute("height");
						if (wAttr && hAttr) {
							topRes = `${wAttr}x${hAttr}`;
						}
					}
				}
				return { kind, url, topKbps: Math.round(topBw / 1000), topRes };
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
				return { kind, url, topKbps: Math.round(topBw / 1000), topRes };
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
