import axios from "axios";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { InvalidVideoIdException, OdyseeDRMProtectedVideo } from "../exceptions.js";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { Parser as M3U8Parser } from "m3u8-parser";

const log = getLogger("odysee");

// API for Odysee
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
		value?: {
			thumbnail?: string | { url?: string };
			cover?: { url?: string };
		};
	};
}

type ResolveMap = Record<
	string,
	{
		canonical_url?: string;
		permanent_url?: string;
		claim_id?: string;
		name?: string;
		value_type?: string; // "stream" | "repost" | "channel" | ...
		value?: {
			title?: string;
			license?: string;
			description?: string;
			release_time?: number | string;
			thumbnail?: string | { url?: string };
			video?: { duration?: number; height?: number };
			reposted_claim?: {
				canonical_url?: string;
				claim_id?: string;
				value_type?: string;
				value?: {
					title?: string;
					license?: string;
					description?: string;
					release_time?: number | string;
					thumbnail?: string | { url?: string };
					video?: { duration?: number; height?: number };
				};
			};
		};
		signing_channel?: {
			name?: string;
			canonical_url?: string;
			value?: {
				thumbnail?: string | { url?: string };
				cover?: { url?: string };
			};
		};
	}
>;

async function resolveCanonicalUri(inputLbryUri: string): Promise<{
	canonicalUri: string;
	resolved: ResolveMap[string];
}> {
	const res = await rpc<ResolveMap>("resolve", { urls: [inputLbryUri] });
	const entry = res[inputLbryUri];
	if (!entry) {
		throw new Error("resolve() returned no entry for URI");
	}

	if (entry.value_type === "repost" && entry.value?.reposted_claim?.canonical_url) {
		return { canonicalUri: entry.value.reposted_claim.canonical_url, resolved: entry };
	}

	if (!entry.canonical_url) {
		throw new Error("resolve() returned no canonical_url");
	}
	return { canonicalUri: entry.canonical_url, resolved: entry };
}

//Copyrighted Content from Odysee isnt available via API and gets blocked (http error 401)
function isCopyrightRestricted(resolved?: ResolveMap[string]): boolean {
	const lic = resolved?.value?.license ?? resolved?.value?.reposted_claim?.value?.license;
	log.debug(String(lic));
	return typeof lic === "string" && /copyright/i.test(lic);
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

	log.debug(`Odysee RPC ${method} response: ${JSON.stringify(res.data)}`);

	if (!res?.data || typeof res.data.result === "undefined") {
		const errMsg = res?.data?.error?.message ? ` (${res.data.error.message})` : "";
		throw new Error(`Odysee RPC returned no result for ${method}${errMsg}`);
	}
	return res.data.result as T;
}

function parseOdyseeUrlToLbry(uriOrUrl: string): string | null {
	if (!uriOrUrl || typeof uriOrUrl !== "string") {
		return null;
	}
	if (uriOrUrl.startsWith("lbry://")) {
		return uriOrUrl;
	}

	// https://odysee.com/@Channel:xx/Video:yy  →  lbry://@Channel#xx/Video#yy
	const m = uriOrUrl.match(/odysee\.com\/(@[^/]+)(?:\/([^?#]+))?/i);
	if (!m) {
		return null;
	}

	const chan = m[1].replace(":", "#");
	const vid = m[2] ? m[2].replace(":", "#") : "";
	return `lbry://${chan}${vid ? "/" + vid : ""}`;
}

function extractThumbnails(thumb: unknown): string[] {
	const out: string[] = [];
	if (typeof thumb === "string") {
		out.push(thumb);
	} else if (thumb && typeof thumb === "object" && "url" in (thumb as any)) {
		const url = (thumb as { url?: string }).url;
		if (url) {
			out.push(url);
		}
	}
	return out;
}

// --- HLS helpers ---
function isHlsMimeOrUrl(mime?: string | null, url?: string): boolean {
	const m = (mime || "").toLowerCase();
	return (
		/\.m3u8(\?|$)/i.test(url || "") ||
		m.includes("application/x-mpegurl") ||
		m.includes("application/vnd.apple.mpegurl") ||
		m === "application/mpegurl" ||
		m === "audio/mpegurl"
	);
}

function normalizeMime(mimeFromServer?: string | null, url?: string): string {
	return isHlsMimeOrUrl(mimeFromServer, url)
		? "application/x-mpegURL"
		: mimeFromServer && mimeFromServer.startsWith("video/")
		? mimeFromServer
		: "video/mp4";
}

function resolveRelativeUrl(base: string, maybeRelative: string): string {
	try {
		return new URL(maybeRelative, base).toString();
	} catch {
		return maybeRelative;
	}
}

async function pickBestHlsVariant(masterUrl: string): Promise<string> {
	try {
		const r = await axios.get(masterUrl, {
			responseType: "text",
			timeout: 12000,
			maxRedirects: 5,
			headers: {
				"Referer": "https://odysee.com/",
				"Origin": "https://odysee.com",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
				"Accept": "application/vnd.apple.mpegurl,application/x-mpegurl,*/*",
			},
			validateStatus: s => s >= 200 && s < 400,
		});

		const parser = new M3U8Parser();
		parser.push(typeof r.data === "string" ? r.data : String(r.data));
		parser.end();

		const manifest = parser.manifest as any;
		const playlists = Array.isArray(manifest?.playlists) ? manifest.playlists : [];
		if (!playlists.length) {
			// No variants => already a media playlist
			return masterUrl;
		}

		playlists.sort((a: any, b: any) => {
			const bwA = a?.attributes?.BANDWIDTH ?? 0;
			const bwB = b?.attributes?.BANDWIDTH ?? 0;
			if (bwA !== bwB) {
				return bwB - bwA;
			}
			const hA = a?.attributes?.RESOLUTION?.height ?? 0;
			const hB = b?.attributes?.RESOLUTION?.height ?? 0;
			return hB - hA;
		});

		const best = playlists[0];
		const bestUri: string | undefined = best?.uri || best?.attributes?.URI;
		if (typeof bestUri === "string" && bestUri.length) {
			const abs = resolveRelativeUrl(masterUrl, bestUri);
			log.debug?.(`HLS: selected best variant ${abs}`);
			return abs;
		}
	} catch (e: any) {
		log.warn?.(`HLS parse failed for ${masterUrl}: ${e?.message ?? e}`);
	}
	return masterUrl;
}

async function verifyStream(
	url: string
): Promise<{ ok: boolean; status?: number; mime?: string; finalUrl?: string }> {
	try {
		const head = await axios.head(url, {
			timeout: 8000,
			maxRedirects: 5,
			validateStatus: s => (s >= 200 && s < 400) || s === 405,
			headers: {
				"Referer": "https://odysee.com/",
				"Origin": "https://odysee.com",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
				"Accept": "application/json,text/plain,*/*",
			},
		});
		const mime = head.headers?.["content-type"] || head.headers?.["Content-Type"];
		const finalUrl =
			(head as any)?.request?.res?.responseUrl ||
			(head.headers?.location && typeof head.headers.location === "string"
				? head.headers.location
				: undefined) ||
			url;
		return {
			ok: head.status >= 200 && head.status < 400,
			status: head.status,
			mime: typeof mime === "string" ? mime : undefined,
			finalUrl,
		};
	} catch {
		try {
			const get = await axios.get(url, {
				responseType: "arraybuffer",
				timeout: 8000,
				maxRedirects: 5,
				validateStatus: s => s === 206 || (s >= 200 && s < 300),
				headers: {
					"Range": "bytes=0-1",
					"Referer": "https://odysee.com/",
					"Origin": "https://odysee.com",
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
					"Accept": "application/json,text/plain,*/*",
				},
			});
			const mime = get.headers?.["content-type"] || get.headers?.["Content-Type"];
			const finalUrl =
				(get as any)?.request?.res?.responseUrl ||
				(get.headers?.location && typeof get.headers.location === "string"
					? get.headers.location
					: undefined) ||
				url;
			return {
				ok: true,
				status: get.status,
				mime: typeof mime === "string" ? mime : undefined,
				finalUrl,
			};
		} catch (e: any) {
			log.warn(`verifyStream failed for ${url}: ${e?.message ?? e}`);
			return { ok: false };
		}
	}
}

export default class OdyseeAdapter extends ServiceAdapter {
	get serviceId(): VideoService {
		return "odysee";
	}

	get isCacheSafe(): boolean {
		return true;
	}

	async initialize(): Promise<void> {
		// no config available yet
	}

	canHandleURL(url: string): boolean {
		return (
			typeof url === "string" && (url.startsWith("lbry://") || /\bodysee\.com\//i.test(url))
		);
	}

	isCollectionURL(url: string): boolean {
		// maybe future update
		return false;
	}

	getVideoId(url: string): string {
		const lbry = url.startsWith("lbry://") ? url : parseOdyseeUrlToLbry(url);
		if (!lbry) {
			throw new InvalidVideoIdException(this.serviceId, url);
		}
		return lbry;
	}

	async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		const { canonicalUri, resolved } = await resolveCanonicalUri(videoId);
		const uriForGet =
			resolved?.permanent_url && typeof resolved.permanent_url === "string"
				? resolved.permanent_url
				: canonicalUri;

		if (isCopyrightRestricted(resolved)) {
			const license =
				resolved?.value?.license ?? resolved?.value?.reposted_claim?.value?.license;
			log.error("Odysee: copyright-restricted claim detected; aborting with FE exception.");
			throw new OdyseeDRMProtectedVideo({ license });
		}
		let got = await rpc<LbryGetResult>("get", { uri: uriForGet, save_file: false });

		if (!got?.streaming_url) {
			log.debug("Odysee get(save_file:false) had no streaming_url, retrying plain get()");
			got = await rpc<LbryGetResult>("get", { uri: uriForGet });
		}

		if (!got?.streaming_url) {
			const dbg = JSON.stringify({ claim_id: got?.claim_id, mime_type: got?.mime_type });
			throw new Error(`Odysee RPC get() returned no streaming_url (${dbg})`);
		}

		let finalStreamingUrl = got.streaming_url;

		// Always verify the stream and adopt redirects + authoritative MIME.
		let baseMimeHeader: string | null =
			typeof got.mime_type === "string" && got.mime_type.length ? got.mime_type : null;
		const ver = await verifyStream(finalStreamingUrl);
		if (ver.ok) {
			if (
				ver.finalUrl &&
				ver.finalUrl.startsWith("http") &&
				ver.finalUrl !== finalStreamingUrl
			) {
				log.debug?.(`verifyStream: redirect detected -> using finalUrl: ${ver.finalUrl}`);
				finalStreamingUrl = ver.finalUrl;
			}
			if (typeof ver.mime === "string" && ver.mime.length > 0) {
				baseMimeHeader = ver.mime;
			}
		} else {
			log.warn?.(`verifyStream: could not validate stream url=${finalStreamingUrl}`);
		}

		if (isHlsMimeOrUrl(baseMimeHeader, finalStreamingUrl)) {
			finalStreamingUrl = await pickBestHlsVariant(finalStreamingUrl);
		}

		const v = got.value ?? resolved?.value ?? {};
		const videoMeta = v.video ?? {};
		let thumbnails = extractThumbnails(v.thumbnail);
		if (thumbnails.length === 0 && resolved?.value?.thumbnail) {
			thumbnails = extractThumbnails(resolved.value.thumbnail);
		}
		if (thumbnails.length === 0) {
			const chVal =
				got.signing_channel?.value ?? resolved?.signing_channel?.value ?? undefined;
			if (chVal) {
				if (thumbnails.length === 0 && chVal.thumbnail) {
					thumbnails = extractThumbnails(chVal.thumbnail);
				}
				if (thumbnails.length === 0 && chVal.cover) {
					thumbnails = extractThumbnails(chVal.cover);
				}
			}
		}
		// Last fallback: generic Thumbnail-Service from lbry.com
		if (thumbnails.length === 0) {
			const cid = resolved?.claim_id || got.claim_id;
			if (cid) {
				thumbnails.push(`https://thumbnails.lbry.com/${cid}`);
			}
		}

		const effectiveMime = normalizeMime(baseMimeHeader, finalStreamingUrl);
		const isHls = isHlsMimeOrUrl(effectiveMime, finalStreamingUrl);

		const result: any = {
			service: "odysee",
			id: finalStreamingUrl,
			title: v.title || got.name || "",
			description: v.description || "",
			length: typeof videoMeta.duration === "number" ? videoMeta.duration : undefined,
			thumbnail: thumbnails[0] ?? undefined,
			mime: effectiveMime || "video/mp4",
		};
		if (isHls) {
			result.hls_url = finalStreamingUrl;
		}
		const typedResult = result as unknown as Video;

		const snapshot: Record<string, unknown> = {
			service: typedResult.service,
			id: typedResult.id,
			title: typedResult.title,
			description: typedResult.description,
			length: typedResult.length,
			thumbnail: typedResult.thumbnail,
			mime: typedResult.mime,
		};
		if (isHls) {
			snapshot["hls_url"] = finalStreamingUrl;
		}
		log.debug(`Odysee FE payload -> ${JSON.stringify(snapshot)}`);

		return typedResult;
	}
}
