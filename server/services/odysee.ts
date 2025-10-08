import axios from "axios";
import http from "http";
import https from "https";
import { conf } from "../ott-config.js";
import { getLogger } from "../logger.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { InvalidVideoIdException, OdyseeUnavailableVideo } from "../exceptions.js";
import { Video, VideoMetadata, VideoService } from "ott-common/models/video.js";
import { Parser as M3U8Parser } from "m3u8-parser";
import type { Manifest } from "m3u8-parser";
import { getMimeType } from "../mime.js";

const log = getLogger("odysee");

// API for Odysee
const ODYSEE_RPC = "https://api.na-backend.odysee.com/api/v1/proxy";

// Odysee URL for normalizing
const ODYSEE_WEB = "https://odysee.com";

// Unified AXIOS Timeout
const AXIOS_TIMEOUT_MS = 10000;

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const httpc = axios.create({
	timeout: AXIOS_TIMEOUT_MS,
	maxRedirects: 5,
	httpAgent,
	httpsAgent,
	headers: {
		"User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}`,
	},
});

let guestAuthToken: string | undefined;

async function fetchGuestAuthToken(): Promise<string | undefined> {
	try {
		const res = await axios.post(
			`${ODYSEE_RPC}?m=auth_get`,
			{ jsonrpc: "2.0", method: "auth_get", params: {} },
			{
				validateStatus: s => s < 400,
				timeout: AXIOS_TIMEOUT_MS,
				headers: {
					"User-Agent": `OpenTogetherTube GuestToken`,
				},
			}
		);

		// 1) Try to extract from Set-Cookie (older behavior)
		const cookies: string[] = res.headers["set-cookie"] ?? [];
		const auth = cookies.find(c => c.startsWith("auth_token="));
		if (auth) {
			const token = auth.split(";", 1)[0].split("=", 2)[1];
			log.debug?.("fetchGuestAuthToken: received auth_token via Set-Cookie");
			return token;
		}

		// 2) Try to extract from JSON body (newer API response)
		const maybeToken =
			res.data?.result?.data?.auth_token ||
			res.data?.result?.auth_token ||
			res.data?.auth_token;
		if (typeof maybeToken === "string" && maybeToken.length > 10) {
			log.debug?.("fetchGuestAuthToken: extracted auth_token from JSON body");
			return maybeToken;
		}

		// 3) Try alternative guest account call if auth_get fails
		log.debug?.("fetchGuestAuthToken: no token from auth_get, trying user/new");
		const res2 = await axios.post(
			`${ODYSEE_RPC}?m=user_new`,
			{ jsonrpc: "2.0", method: "user_new", params: {} },
			{
				validateStatus: s => s < 400,
				timeout: AXIOS_TIMEOUT_MS,
				headers: {
					"User-Agent": `OpenTogetherTube GuestToken`,
				},
			}
		);

		const cookies2: string[] = res2.headers["set-cookie"] ?? [];
		const auth2 = cookies2.find(c => c.startsWith("auth_token="));
		if (auth2) {
			const token2 = auth2.split(";", 1)[0].split("=", 2)[1];
			log.debug?.("fetchGuestAuthToken: received auth_token via user_new Set-Cookie");
			return token2;
		}

		const maybeToken2 =
			res2.data?.result?.data?.auth_token ||
			res2.data?.result?.auth_token ||
			res2.data?.auth_token;
		if (typeof maybeToken2 === "string" && maybeToken2.length > 10) {
			log.debug?.("fetchGuestAuthToken: extracted auth_token from user_new JSON body");
			return maybeToken2;
		}

		log.debug?.("fetchGuestAuthToken: no auth_token found in any response");
	} catch (e) {
		log.debug?.("fetchGuestAuthToken failed", { err: String(e) });
	}
	return undefined;
}

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
		source?: { sd_hash?: string };
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

type JsonRpcEnvelope<T> = { jsonrpc: "2.0"; result?: T; error?: { message?: string } };

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
			source?: { sd_hash?: string };
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
					source?: { sd_hash?: string };
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

interface ClaimSearchItem {
	value?: {
		title?: string;
		description?: string;
		video?: { duration?: number };
		thumbnail?: string | { url?: string };
		source?: { sd_hash?: string };
	};
	signing_channel?: {
		value?: {
			thumbnail?: string | { url?: string };
			cover?: { url?: string };
		};
	};
}

interface ClaimSearchResponse {
	items?: ClaimSearchItem[];
}

/**
 * Normalize Odysee URLs the same way browsers do:
 * - Accept Unicode in the path
 * - decodeURI -> Unicode NFC -> encodeURI (UTF-8 percent encoding)
 * - Keep important path characters like `@` and `:` unencoded
 * - Idempotent for already-correctly-encoded inputs
 */
export function normalizeOdyseeUrl(input: string): URL {
	const url = new URL(input, ODYSEE_WEB);
	const decodedPath = decodeURI(url.pathname);
	const normalizedPath = decodedPath.normalize("NFC");
	const reencodedPath = encodeURI(normalizedPath);
	url.pathname = reencodedPath;
	return url;
}

// Resolve and normalize an LBRY URI to its canonical (follow reposts)
async function resolveCanonicalUri(inputLbryUri: string): Promise<{
	canonicalUri: string;
	resolved: ResolveMap[string];
}> {
	try {
		const res = await rpc<ResolveMap>("resolve", { urls: [inputLbryUri] });
		const entry = res[inputLbryUri];
		if (!entry) {
			log.error("resolve() returned no entry for URI");
			throw new OdyseeUnavailableVideo();
		}
		const repost =
			entry.value_type === "repost" ? entry.value?.reposted_claim?.canonical_url : null;
		const canonical = repost || entry.canonical_url;
		if (!canonical) {
			log.error("resolve() returned no canonical_url");
			throw new OdyseeUnavailableVideo();
		}
		return { canonicalUri: canonical, resolved: entry };
	} catch (e) {
		log.debug?.("resolveCanonicalUri failed", { uri: inputLbryUri, err: String(e) });
		throw e;
	}
}

// Call Odysee JSON-RPC and return typed result
async function rpc<T>(
	method: string,
	params: Record<string, unknown>,
	axiosCfg: Partial<Parameters<typeof axios.post>[2]> = {}
): Promise<T> {
	try {
		if (!guestAuthToken) {
			guestAuthToken = await fetchGuestAuthToken();
		}

		log.debug?.("rpc(): current token in use ", { guestAuthToken });

		const res = await httpc.post<JsonRpcEnvelope<T>>(
			`${ODYSEE_RPC}?m=${encodeURIComponent(method)}`,
			{ jsonrpc: "2.0", method, params },
			{
				...axiosCfg,
				headers: {
					"User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}`,
					...(guestAuthToken ? { Cookie: `auth_token=${guestAuthToken}` } : {}),
					...(axiosCfg.headers ?? {}),
				},
			}
		);
		if (!res?.data || typeof res.data.result === "undefined") {
			const errMsg = res?.data?.error?.message ? ` (${res.data.error.message})` : "";
			throw new Error(`Odysee RPC returned no result for ${method}${errMsg}`);
		}
		return res.data.result;
	} catch (e) {
		log.debug?.("rpc error", { method, err: String(e) });
		throw e;
	}
}

// Convert an odysee.com URL to lbry:// form (or pass-through)
function parseOdyseeUrlToLbry(uriOrUrl: string): string | null {
	if (!uriOrUrl) {
		return null;
	}
	if (uriOrUrl.startsWith("lbry://")) {
		return uriOrUrl;
	}
	let url: URL;
	try {
		url = normalizeOdyseeUrl(uriOrUrl);
	} catch {
		return null;
	}
	if (!/(\.|^)odysee\.com$/i.test(url.hostname)) {
		return null;
	}

	// Work on decoded + NFC-normalized path
	const decoded = decodeURI(url.pathname).normalize("NFC");
	const parts = decoded.split("/").filter(Boolean);
	if (!parts[0]) {
		return null;
	}

	// Case 1: Channel-based URL → @channel:xx/slug:yy
	if (parts[0].startsWith("@")) {
		const [channel, channelId] = parts[0].split(":", 2);
		let lbry = `lbry://${channel}${channelId ? `#${channelId}` : ""}`;
		if (parts[1]) {
			const [slug, streamId] = parts[1].split(":", 2);
			lbry += `/${slug}${streamId ? `#${streamId}` : ""}`;
		}
		return lbry;
	}

	// Case 2: Slug-only video → slug:claimId
	if (parts.length === 1 && parts[0].includes(":")) {
		const [slug, claimId] = parts[0].split(":", 2);
		return `lbry://${slug}${claimId ? `#${claimId}` : ""}`;
	}

	return null;
}

// Type guard: true if o is a non-null object and has property key k (own or inherited).
function hasProp<T extends PropertyKey>(o: unknown, k: T): o is Record<T, unknown> {
	return !!o && typeof o === "object" && k in o;
}

function getSdHashFromValue(val: unknown): string | undefined {
	if (hasProp(val, "source") && hasProp(val.source, "sd_hash")) {
		const sd = val.source.sd_hash;
		return typeof sd === "string" ? sd : undefined;
	}
	return undefined;
}

function extractThumbnails(thumb: unknown): string[] {
	const out: string[] = [];
	if (typeof thumb === "string") {
		out.push(thumb);
	} else if (hasProp(thumb, "url")) {
		const u = thumb.url;
		if (typeof u === "string" && u) {
			out.push(u);
		}
	}
	return out;
}

// Collect thumbnails with fallbacks: claim -> channel -> lbry.com
function collectThumbnails(resolved: ResolveMap[string] | undefined, got: LbryGetResult): string[] {
	const v = got.value ?? resolved?.value ?? {};
	let thumbnails = extractThumbnails(v.thumbnail);
	if (thumbnails.length === 0 && resolved?.value?.thumbnail) {
		thumbnails = extractThumbnails(resolved.value.thumbnail);
	}
	if (thumbnails.length === 0) {
		const chVal = got.signing_channel?.value ?? resolved?.signing_channel?.value;
		if (chVal?.thumbnail) {
			thumbnails = extractThumbnails(chVal.thumbnail);
		}
		if (thumbnails.length === 0 && chVal?.cover) {
			thumbnails = extractThumbnails(chVal.cover);
		}
	}
	if (thumbnails.length === 0) {
		// Fallback: build via the stream's claim_id (not the channel id)
		const cid = resolved?.claim_id ?? got.claim_id;
		if (cid) {
			thumbnails.push(`https://thumbnails.lbry.com/${cid}`);
		}
	}
	return thumbnails;
}

function isOdyCdnHost(u: string): boolean {
	try {
		const host = new URL(u).hostname; // hostname has no port
		return isHostUnderDomain(host, "odycdn.com");
	} catch {
		return false;
	}
}

// Detect HLS by MIME or URL pattern
function isHlsMimeOrUrl(mime?: string | null, url?: string): boolean {
	const m = (mime || "").toLowerCase();
	if (
		m === "application/x-mpegurl" ||
		m === "application/vnd.apple.mpegurl" ||
		m === "application/mpegurl" ||
		m === "audio/mpegurl"
	) {
		return true;
	}
	if (url) {
		const clean = url.split("#")[0].split("?")[0];
		const filename = clean.split("/").pop() ?? "";
		const ext = (filename.split(".").pop() ?? "").toLowerCase();
		if (ext && getMimeType(ext) === "application/x-mpegURL") {
			return true;
		}
	}
	return false;
}

// Canonicalize MIME; map HLS to application/x-mpegURL; default to MP4
function normalizeMime(mimeFromServer?: string | null, url?: string): string {
	if (isHlsMimeOrUrl(mimeFromServer, url)) {
		return "application/x-mpegURL";
	}
	return mimeFromServer?.startsWith("video/") ? mimeFromServer : "video/mp4";
}

const _baseUrlCache = new Map<string, URL>();

function resolveRelativeUrl(base: string | URL, maybeRelative: string): string {
	try {
		const b = typeof base === "string" ? new URL(base) : base;
		return new URL(maybeRelative, b).toString();
	} catch {
		return maybeRelative;
	}
}

// Try a list of candidate URLs and return the first that verifies
async function firstVerifyingUrl(candidates: string[]): Promise<string | undefined> {
	for (const u of candidates) {
		const v = await verifyStream(u);
		if (v.ok && (v.finalUrl?.startsWith("http") ? v.finalUrl : u)) {
			return v.finalUrl && v.finalUrl.startsWith("http") ? v.finalUrl : u;
		}
	}
	return undefined;
}

// For odycdn MP4 links, try to discover an HLS master playlist
function guessHlsCandidatesFromMp4(mp4Url: string): string[] {
	try {
		const u = new URL(mp4Url);
		// 1) master.m3u8 in same directory (…/master.m3u8)
		const partsPath = u.pathname.split("/");
		const sameDir = (() => {
			const p = partsPath.slice(0, -1).join("/"); // drop filename
			return `${u.origin}${p}/master.m3u8`;
		})();
		return [sameDir];
	} catch {
		return [];
	}
}

// Extract final URL from axios response (redirects) or use fallback
function responseFinalUrl(
	nodeResponseUrl: string | undefined,
	locationHeader: string | undefined,
	fallback: string
): string {
	return nodeResponseUrl ?? locationHeader ?? fallback;
}

// Parse M3U8 master and pick the highest-quality variant
async function pickBestHlsVariant(masterUrl: string): Promise<string> {
	try {
		const v = await verifyStream(masterUrl);
		if (!v.ok) {
			log.debug?.("pickBestHlsVariant: master not verifiable", {
				masterUrl,
				status: v.status,
			});
			return masterUrl;
		}
		const r = await httpc.get(masterUrl, {
			responseType: "text",
			headers: {
				Accept: "application/vnd.apple.mpegurl,application/x-mpegurl,*/*",
			},
			validateStatus: s => s >= 200 && s < 400,
		});

		const parser = new M3U8Parser();
		parser.push(r.data);
		parser.end();

		const manifest: Manifest = parser.manifest;
		const playlists = Array.isArray(manifest.playlists) ? manifest.playlists : [];
		if (!playlists.length) {
			return masterUrl;
		}

		playlists.sort((a, b) => {
			const bwDiff = (b.attributes?.BANDWIDTH ?? 0) - (a.attributes?.BANDWIDTH ?? 0);
			if (bwDiff !== 0) {
				return bwDiff;
			}
			const hA = a.attributes?.RESOLUTION?.height ?? 0;
			const hB = b.attributes?.RESOLUTION?.height ?? 0;
			return hB - hA;
		});

		const best = playlists[0];
		const bestUri = best.uri ?? best.attributes?.URI;
		if (bestUri) {
			const baseUrl = new URL(masterUrl);
			const abs = resolveRelativeUrl(baseUrl, bestUri);
			log.debug?.(`HLS: selected best variant ${abs}`);
			return abs;
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		log.debug?.("pickBestHlsVariant failed", { masterUrl, err: msg });
	}
	return masterUrl;
}

// Verify stream via HEAD (fallback GET range), get final URL and MIME
async function verifyStream(
	url: string
): Promise<{ ok: boolean; status?: number; mime?: string; finalUrl?: string }> {
	try {
		const head = await httpc.head(url, {
			validateStatus: s => (s >= 200 && s < 300) || s === 405,
			headers: { Accept: "application/json,text/plain,*/*" },
		});
		const mime = head.headers?.["content-type"];
		const loc = head.headers?.["location"];
		const finalUrl = responseFinalUrl(
			head.request?.res?.responseUrl,
			typeof loc === "string" ? loc : undefined,
			url
		);

		return {
			ok: head.status >= 200 && head.status < 300,
			status: head.status,
			mime: typeof mime === "string" ? mime : undefined,
			finalUrl,
		};
	} catch {
		// Fallback: some Odysee servers/CDNs either block HEAD, hide content-type on HEAD,
		// or only expose the effective redirect chain on real GET requests.
		// Use the smallest possible GET via Range to avoid data transfer.
		try {
			const get = await httpc.get(url, {
				responseType: "arraybuffer",
				validateStatus: s => s === 206 || s === 200,
				headers: {
					Range: "bytes=0-1",
					Accept: "application/json,text/plain,*/*",
				},
			});
			const mime = get.headers?.["content-type"];
			const loc = get.headers?.["location"];
			const finalUrl = responseFinalUrl(
				get.request?.res?.responseUrl,
				typeof loc === "string" ? loc : undefined,
				url
			);
			return {
				ok: true,
				status: get.status,
				mime: typeof mime === "string" ? mime : undefined,
				finalUrl,
			};
		} catch (e2: unknown) {
			const status = axios.isAxiosError(e2) ? e2.response?.status : undefined;
			const msg = e2 instanceof Error ? e2.message : String(e2);

			if (status === 401 || status === 404 || status === 403) {
				// Log expected restricted status explicitly with URL and message
				log.debug?.(
					`verifyStream: restricted or blocked => url=${url}, status=${status}, message=${msg}`
				);
			} else {
				log.warn(`verifyStream failed => url=${url}, status=${status}, message=${msg}`);
			}

			// Always log fallback result for visibility
			log.debug?.(`verifyStream result => url=${url}, status=${status}, message=${msg}`);
			return { ok: false, status };
		}
	}
}

function isHostUnderDomain(host: string, domain: string): boolean {
	const h = host.toLowerCase().replace(/\.$/, ""); // tolerate a trailing dot
	const d = domain.toLowerCase();
	return h === d || h.endsWith(`.${d}`);
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
		if (!url) {
			return false;
		}
		try {
			const u = normalizeOdyseeUrl(url);
			return /(\.|^)odysee\.com$/i.test(u.hostname) || /(\.|^)odycdn\.com$/i.test(u.hostname);
		} catch {
			return false;
		}
	}

	isCollectionURL(url: string): boolean {
		// maybe future update
		return false;
	}

	getVideoId(url: string): string {
		try {
			const host = new URL(url).hostname;
			if (isHostUnderDomain(host, "odycdn.com")) {
				return url;
			}
			if (isHostUnderDomain(host, "odysee.com")) {
				const lbry = parseOdyseeUrlToLbry(url);
				if (lbry) {
					return lbry;
				}
			}
		} catch {
			// Fall through
		}
		throw new InvalidVideoIdException(this.serviceId, url);
	}

	async fetchVideoInfo(videoId: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		const isOdyCdn = isOdyCdnHost(videoId);
		if (isOdyCdn) {
			let finalStreamingUrl = videoId;
			const ver = await verifyStream(finalStreamingUrl);
			if (ver.ok && ver.finalUrl?.startsWith("http") && ver.finalUrl !== finalStreamingUrl) {
				log.debug?.(`verifyStream: redirect detected -> using finalUrl: ${ver.finalUrl}`);
				finalStreamingUrl = ver.finalUrl;
			}
			const effectiveMime = normalizeMime(ver.mime ?? null, finalStreamingUrl);
			let isHls = isHlsMimeOrUrl(effectiveMime, finalStreamingUrl);

			let thumbnail = "";
			let title = "";
			let description = "";
			let length: number | undefined;
			/**
			 * The LBRY protocol /The Odysee website uses `claim_id` (hex string) of the *stream* claim.
			 * Used for diagnostics and as a fallback to build a thumbnail URL
			 * via https://thumbnails.lbry.com/<claim_id>.
			 */
			let claimId: string | undefined;

			try {
				const path = new URL(finalStreamingUrl).pathname.split("/");
				const i = path.indexOf("streams");
				if (i >= 0 && path[i + 1]) {
					claimId = path[i + 1];
					thumbnail = `https://thumbnails.lbry.com/${claimId}`;
				}
			} catch (e) {
				log.debug?.("extract claimId from URL failed", {
					url: finalStreamingUrl,
					err: String(e),
				});
			}

			if (claimId) {
				try {
					const meta = await rpc<ClaimSearchResponse>("claim_search", {
						claim_ids: [claimId],
						no_totals: true,
						page_size: 1,
					});
					const item = meta.items?.[0];
					const v = item?.value;
					if (v) {
						if (typeof v.title === "string") {
							title = v.title;
						}
						if (typeof v.description === "string") {
							description = v.description;
						}
						if (typeof v.video?.duration === "number") {
							length = v.video.duration;
						}

						// Prefer exact HLS if we can reconstruct from claimId + sd_hash
						const sdHash = v.source?.sd_hash ?? getSdHashFromValue(v);
						if (typeof sdHash === "string" && claimId) {
							const cand = `https://player.odycdn.com/v6/streams/${claimId}/${sdHash}/master.m3u8`;
							const h = await firstVerifyingUrl([cand]);
							if (h) {
								finalStreamingUrl = h;
								isHls = true;
							}
						}
						// Thumbnail from the claim itself
						const claimThumbs = extractThumbnails(v.thumbnail);
						if (claimThumbs.length && !thumbnail) {
							thumbnail = claimThumbs[0];
						}
					}
					// Fallback: channel visuals
					const chv = item?.signing_channel?.value;
					if (chv && !thumbnail) {
						const chThumbs = extractThumbnails(chv.thumbnail);
						if (chThumbs.length) {
							thumbnail = chThumbs[0];
						} else if (typeof chv.cover?.url === "string" && chv.cover.url) {
							thumbnail = chv.cover.url;
						}
					}
				} catch (e) {
					log.debug?.("claim_search failed (odycdn path)", { claimId, err: String(e) });
				}
			}
			if (!isHls) {
				const candidates = guessHlsCandidatesFromMp4(finalStreamingUrl);
				const hls = await firstVerifyingUrl(candidates);
				if (hls) {
					finalStreamingUrl = hls;
					isHls = true;
				}
			}

			const finalCheck = await verifyStream(finalStreamingUrl);
			if (!finalCheck.ok) {
				log.debug?.("odycdn final URL not playable", {
					url: finalStreamingUrl,
					status: finalCheck.status,
				});
				throw new OdyseeUnavailableVideo();
			}

			const result: Video = {
				service: "odysee",
				id: finalStreamingUrl, // Direct-Play requires id to be the actual HTTP URL
				title,
				description,
				length,
				thumbnail,
				mime: isHls ? "application/x-mpegURL" : effectiveMime || "video/mp4",
			};
			if (isHls) {
				result.hls_url = finalStreamingUrl;
			}

			const snapshot: Record<string, unknown> = {
				service: result.service,
				id: result.id,
				title: result.title,
				length: result.length,
				mime: result.mime,
				thumbnail: result.thumbnail,
				...(isHls ? { hls_url: finalStreamingUrl } : null),
			};
			log.debug(`Odysee FE payload (bypass resolve) -> ${JSON.stringify(snapshot)}`);
			return result;
		}

		const { canonicalUri, resolved } = await resolveCanonicalUri(videoId);
		if (
			resolved?.value?.license &&
			resolved.value.license.toLowerCase().includes("copyright")
		) {
			log.warn?.("DRM/Copyright-locked video detected -  blocking", {
				uri: canonicalUri,
				license: resolved.value.license,
			});
			throw new OdyseeUnavailableVideo("Video is copyright-locked and not playable.");
		}
		const uriForGet = resolved?.permanent_url ?? canonicalUri;

		let got: LbryGetResult;
		try {
			got = await rpc<LbryGetResult>("get", { uri: uriForGet, save_file: false });
		} catch (e) {
			log.debug?.("rpc get(save_file:false) failed", { uri: uriForGet, err: String(e) });
			throw e;
		}

		if (!got?.streaming_url) {
			log.debug("Odysee get(save_file:false) had no streaming_url, retrying plain get()");
			try {
				got = await rpc<LbryGetResult>("get", { uri: uriForGet });
			} catch (e) {
				log.debug?.("rpc get() failed", { uri: uriForGet, err: String(e) });
				throw e;
			}
		}

		if (!got?.streaming_url) {
			// Attempt to recover with claim_search -> reconstruct streaming URL manually
			log.warn("Odysee get() returned no streaming_url – trying claim_search fallback");
			const claimId = got?.claim_id;
			const sdHash = getSdHashFromValue(got?.value);
			if (typeof claimId === "string" && typeof sdHash === "string") {
				const hlsUrl = `https://player.odycdn.com/v6/streams/${claimId}/${sdHash}/master.m3u8`;
				const verified = await verifyStream(hlsUrl);
				if (verified.ok) {
					log.debug?.("Recovered streaming_url via claim_search fallback", { hlsUrl });
					got.streaming_url = hlsUrl;
					got.mime_type = verified.mime;
				}
			}
		}
		if (!got?.streaming_url) {
			const dbg = JSON.stringify({ claim_id: got?.claim_id, mime_type: got?.mime_type });
			log.warn("Odysee RPC get() returned no streaming_url – treated as unavailable", {
				dbg,
			});
			throw new OdyseeUnavailableVideo();
		}

		let finalStreamingUrl = got.streaming_url;

		// Always verify the stream and adopt redirects + authoritative MIME.
		let baseMimeHeader: string | null = got.mime_type ?? null;

		const ver = await verifyStream(finalStreamingUrl);
		if (ver.ok) {
			if (ver.finalUrl?.startsWith("http") && ver.finalUrl !== finalStreamingUrl) {
				log.debug?.(`verifyStream: redirect detected -> using finalUrl: ${ver.finalUrl}`);
				finalStreamingUrl = ver.finalUrl;
			}
			if (ver.mime) {
				baseMimeHeader = ver.mime;
			}
		} else {
			log.warn?.(`verifyStream: could not validate stream url=${finalStreamingUrl}`);
			throw new OdyseeUnavailableVideo();
		}

		const isMasterHls = isHlsMimeOrUrl(baseMimeHeader, finalStreamingUrl);
		if (isMasterHls) {
			finalStreamingUrl = await pickBestHlsVariant(finalStreamingUrl);
		}

		const v = got.value ?? resolved?.value ?? {};
		const videoMeta = v.video ?? {};
		const thumbnails = collectThumbnails(resolved, got);

		let effectiveMime = normalizeMime(baseMimeHeader, finalStreamingUrl);
		let isHls = isHlsMimeOrUrl(effectiveMime, finalStreamingUrl);
		// Prefer HLS when we can construct it precisely from claim_id + sd_hash
		if (!isHls && isOdyCdnHost(finalStreamingUrl)) {
			try {
				new URL(finalStreamingUrl);
			} catch (e) {
				log.debug?.("invalid finalStreamingUrl", {
					url: finalStreamingUrl,
					err: String(e),
				});
			}

			// Stream claim_id preferred from resolve(); fall back to get() payload.
			const claimId = resolved?.claim_id ?? got.claim_id;

			const sd = getSdHashFromValue(v);
			if (typeof claimId === "string" && typeof sd === "string") {
				const exact = `https://player.odycdn.com/v6/streams/${claimId}/${sd}/master.m3u8`;
				const h = await firstVerifyingUrl([exact]);
				if (h) {
					finalStreamingUrl = h;
					effectiveMime = "application/x-mpegURL";
					isHls = true;
				}
			}
			if (!isHls) {
				const candidates = guessHlsCandidatesFromMp4(finalStreamingUrl);
				const hls = await firstVerifyingUrl(candidates);
				if (hls) {
					finalStreamingUrl = hls;
					effectiveMime = "application/x-mpegURL";
					isHls = true;
				}
			}
		}

		const finalCheck2 = await verifyStream(finalStreamingUrl);
		if (!finalCheck2.ok) {
			log.debug?.("final URL not playable (resolve path)", {
				url: finalStreamingUrl,
				status: finalCheck2.status,
			});
			throw new OdyseeUnavailableVideo();
		}

		const result: Video = {
			service: "odysee",
			id: finalStreamingUrl,
			title: v.title || got.name || "",
			description: v.description || "",
			length: videoMeta.duration,
			thumbnail: thumbnails[0],
			mime: effectiveMime || "video/mp4",
		};
		if (isHls) {
			result.hls_url = finalStreamingUrl;
		}

		const snapshot: Record<string, unknown> = {
			service: result.service,
			id: result.id,
			title: result.title,
			length: result.length,
			thumbnail: result.thumbnail,
			mime: result.mime,
			...(isHls ? { hls_url: finalStreamingUrl } : null),
		};
		log.debug(`Odysee FE payload -> ${JSON.stringify(snapshot)}`);

		return result;
	}
}
