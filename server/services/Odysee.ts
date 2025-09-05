import axios from "axios";
import maxBy from "lodash/maxBy.js";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { InvalidVideoIdException } from "../exceptions.js";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { conf } from "../ott-config.js"; // Future Use
import storage from "../storage.js";

const log = getLogger("odysee");

// Known API for Odysee
const ODYSEE_RPC = "https://api.na-backend.odysee.com/api/v1/proxy";

interface LbryGetResult {
	claim_id?: string;
	name?: string;
	mime_type?: string;
	streaming_url?: string;
	value?: {
		title?: string;
		description?: string;
		release_time?: number | string;
		thumbnail?: string | { url?: string };
		video?: {
			duration?: number;
			height?: number;
		};
	};
	signing_channel?: {
		name?: string;
		canonical_url?: string;
	};
}

type ProgressiveLiteral = "progressive";
interface ProgressiveQuality {
	label: string;
	type: ProgressiveLiteral; // "progressive"
	url: string;
	mime: string;
	isDefault: boolean;
}

interface OdyseeOptions {
	experimentalQualities: boolean;
	qualityCandidates: string[];
}

async function rpc<T>(
	method: string,
	params: Record<string, unknown>,
	axiosCfg: Partial<Parameters<typeof axios.post>[2]> = {}
): Promise<T> {
	const res = await axios.post(
		`${ODYSEE_RPC}?m=${encodeURIComponent(method)}`,
		{ jsonrpc: "2.0", method, params },
		{ timeout: 12000, ...axiosCfg }
	);
	if (!res?.data || typeof res.data.result === "undefined") {
		throw new Error(`Odysee RPC returned no result for ${method}`);
	}
	return res.data.result as T;
}

function parseOdyseeUrlToLbry(uriOrUrl: string): string | null {
	if (!uriOrUrl || typeof uriOrUrl !== "string") return null;
	if (uriOrUrl.startsWith("lbry://")) return uriOrUrl;

	// https://odysee.com/@Channel:xx/Video:yy  →  lbry://@Channel#xx/Video#yy
	const m = uriOrUrl.match(/odysee\.com\/(@[^/]+)(?:\/([^?#]+))?/i);
	if (!m) return null;

	const chan = m[1].replace(":", "#");
	const vid = m[2] ? m[2].replace(":", "#") : "";
	return `lbry://${chan}${vid ? "/" + vid : ""}`;
}

function extractThumbnails(thumb: unknown): string[] {
	const out: string[] = [];
	if (typeof thumb === "string") out.push(thumb);
	else if (thumb && typeof thumb === "object" && "url" in (thumb as any)) {
		const url = (thumb as { url?: string }).url;
		if (url) out.push(url);
	}
	return out;
}

function heightFromLabel(label: string): number {
	const m = label.match(/^(\d+)[pP]$/);
	return m ? parseInt(m[1], 10) : Number.NEGATIVE_INFINITY;
}

async function probeExperimentalQualities(
	sourceUrl: string,
	candidates: string[]
): Promise<ProgressiveQuality[]> {
	let u: URL;
	try {
		u = new URL(sourceUrl);
	} catch {
		return [];
	}

	const host = u.hostname.toLowerCase();
	const allowedHosts = [
		"cdn.lbryplayer.xyz",
		"player.odycdn.com",
		"player.odysee.com",
		"cdn.odysee.com",
		"lbryplayer.xyz",
	];
	if (!allowedHosts.some(h => host.endsWith(h))) return [];

	const results: ProgressiveQuality[] = [];
	for (const q of candidates) {
		const test = new URL(u.toString());
		const params = new URLSearchParams(test.search);
		params.set("quality", q);
		test.search = `?${params.toString()}`;

		try {
			const head = await axios.head(test.toString(), {
				timeout: 8000,
				maxRedirects: 5,
				validateStatus: s => (s >= 200 && s < 400) || s === 405,
			});

			let ok = head.status >= 200 && head.status < 400;
			let mime = head.headers?.["content-type"] || head.headers?.["Content-Type"];

			if (!ok || (mime && typeof mime === "string" && !mime.startsWith("video/"))) {
				const get = await axios.get(test.toString(), {
					headers: { Range: "bytes=0-1" },
					responseType: "arraybuffer",
					timeout: 8000,
					maxRedirects: 5,
					validateStatus: s => s === 206 || (s >= 200 && s < 300),
				});
				ok = get.status === 206 || (get.status >= 200 && get.status < 300);
				mime = get.headers?.["content-type"] || get.headers?.["Content-Type"];
			}

			if (ok) {
				const mimeStr = typeof mime === "string" && mime.length ? mime : "video/mp4";
				if (mimeStr.startsWith("video/")) {
					results.push({
						label: q,
						type: "progressive",
						url: test.toString(),
						mime: mimeStr,
						isDefault: false,
					});
				}
			}
		} catch (e: any) {
			log.debug?.(`experimental probe failed for ${test.toString()}: ${e?.message ?? e}`);
		}
	}
	const seen = new Set<string>();
	return results.filter(r => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

export default class OdyseeAdapter extends ServiceAdapter {
	private opts: OdyseeOptions = {
		experimentalQualities: false,
		qualityCandidates: ["144p", "240p", "360p", "480p", "720p", "1080p", "1440p", "2160p"],
	};
	get serviceId(): VideoService {
		return "odysee";
	}

	get isCacheSafe(): boolean {
		return true;
	}

	async initialize(): Promise<void> {
		try {
			// Example, should move to conf at some point
			this.opts.experimentalQualities = true;
			this.opts.qualityCandidates = [
				"144p",
				"240p",
				"360p",
				"480p",
				"720p",
				"1080p",
				"1440p",
				"2160p",
			];
			log.info?.(
				`Odysee init: experimentalQualities=${
					this.opts.experimentalQualities
				}, candidates=[${this.opts.qualityCandidates.join(", ")}]`
			);
		} catch (e: any) {
			log.warn?.(`Odysee init config read failed: ${e?.message ?? e}`);
		}
	}

	canHandleURL(url: string): boolean {
		return (
			typeof url === "string" && (url.startsWith("lbry://") || /\bodysee\.com\//i.test(url))
		);
	}

	isCollectionURL(url: string): boolean {
		return false;
	}

	getVideoId(url: string): string {
		const lbry = parseOdyseeUrlToLbry(url);
		if (!lbry) {
			throw new InvalidVideoIdException(this.serviceId, "Unsupported or invalid Odysee URL");
		}
		return lbry;
	}

	async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		// RPC: get
		const got = await rpc<LbryGetResult>("get", { uri: videoId });
		if (!got?.streaming_url) {
			throw new Error("Odysee RPC get() returned no streaming_url");
		}

		const v = got.value ?? {};
		const videoMeta = v.video ?? {};
		const thumbnails = extractThumbnails(v.thumbnail);

		const baseLabel =
			typeof videoMeta.height === "number" && videoMeta.height > 0
				? `${videoMeta.height}p`
				: "source";
		const baseMime =
			typeof got.mime_type === "string" && got.mime_type.length ? got.mime_type : "video/mp4";

		const baseQuality: ProgressiveQuality = {
			label: baseLabel,
			type: "progressive",
			url: got.streaming_url!,
			mime: baseMime,
			isDefault: true,
		};

		let qualities: ProgressiveQuality[] = [baseQuality];

		if (this.opts.experimentalQualities) {
			try {
				const extra = await probeExperimentalQualities(
					got.streaming_url!,
					this.opts.qualityCandidates
				);
				if (extra.length) {
					const known = new Set(qualities.map(q => q.url));
					for (const q of extra) if (!known.has(q.url)) qualities.push(q);
					// Nur UI-Ordnung: absteigend nach Auflösung sortieren
					qualities.sort((a, b) => heightFromLabel(b.label) - heightFromLabel(a.label));
					// Beispielhafter Einsatz von maxBy (verhindert "unused import"):
					const top = maxBy(qualities, q => heightFromLabel(q.label));
					if (top) log.debug?.(`top detected by probe: ${top.label}`);
				}
			} catch (e: any) {
				log.warn?.(`Experimental qualities failed: ${e?.message ?? e}`);
			}
		}

		const channelName = got.signing_channel?.name || got.signing_channel?.canonical_url || null;
		const releaseTimeNum =
			typeof v.release_time === "string"
				? Number(v.release_time)
				: typeof v.release_time === "number"
				? v.release_time
				: null;

		const result = {
			id: got.claim_id ?? null,
			service: this.serviceId,
			title: v.title || got.name || "",
			description: v.description || "",
			duration: typeof videoMeta.duration === "number" ? videoMeta.duration : null,
			thumbnails,
			channel: channelName,
			releaseTime: releaseTimeNum,
			mime: baseMime,
			// Zusatzfelder analog zu anderen Adaptern:
			type: "progressive",
			streamingUrl: got.streaming_url,
			qualities,
		} as unknown as Video;

		return result;
	}
}
