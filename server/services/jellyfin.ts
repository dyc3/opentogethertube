/**
 * @file jellyfin.ts
 * @description Jellyfin Service Adapter for OpenTogetherTube.
 *
 * Architecture & Protocol Notes:
 * 1. Authentication:
 *    - Jellyfin requires API authentication via client headers (`X-Emby-Client`, `X-Emby-Device`,
 *      `X-Emby-Device-Id`, `X-Emby-Version`) and an API token passed in `X-Emby-Token` or as an `api_key` param.
 *    - User context is resolved through `/Users` (returning existing server users) to query user-scoped library items.
 *
 * 2. Compound ID & Multi-Monolith Routing:
 *    - OpenTogetherTube compound IDs are structured as: `${serverBaseUrl}::${itemId}::${apiKey}`.
 *    - Embedding the API key directly into the compound ID ensures authorization context survives:
 *      a) Multi-node load balancing (preview requests routed to random monoliths vs room queue routed to room monoliths).
 *      b) Server restarts where in-memory caches are purged.
 *    - Legacy 2-part compound IDs (`${serverBaseUrl}::${itemId}`) remain supported via the local `apiKeyCache`.
 *    - Subpaths (e.g. reverse proxy paths like `https://host/jellyfin`) are extracted as `serverBaseUrl`
 *      so that all API endpoints resolve relative to the server's mount path.
 *
 * 3. Media Streaming & Transcoding:
 *    - Streams are fetched via `POST /Items/{itemId}/PlaybackInfo`.
 *    - Minimal body payload (`StartTimeTicks: 0`, `IsPlayback: true`, `AutoOpenLiveStream: true`,
 *      `AlwaysBurnInSubtitleWhenTranscoding: false`) requests a session-backed HLS transcode.
 *    - The resulting `TranscodingUrl` includes a unique `PlaySessionId` with AAC audio and HLS packaging.
 *    - Hardcoded fallback `/Videos/{mediaSourceId}/main.m3u8?api_key=...&AudioCodec=aac` is used
 *      if no transcode URL is emitted.
 *
 * 4. Subtitle Delivery:
 *    - Jellyfin text subtitle streams (`IsTextSubtitleStream && SupportsExternalStream`, e.g. srt, ass, vtt)
 *      are converted to WebVTT on-the-fly by Jellyfin.
 *    - Deliverable subtitle URLs use the server's `DeliveryUrl` or standard 4-segment format:
 *      `${serverBaseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${stream.Index}/0/Stream.vtt?api_key=...`.
 *    - Subtitles are served as native HTML5 `<track>` elements in client players without re-encoding video.
 *
 * 5. Multi-Track Audio Selection:
 *    - Jellyfin streams bind one audio stream per transcode session (`AudioStreamIndex`).
 *    - Audio streams (`Type === "Audio"`) are extracted into `availableAudioTracks` preserving Jellyfin's
 *      global stream `Index` verbatim.
 *    - Runtime track switching is achieved by calling `getRefreshedStream(id, audioStreamIndex)`,
 *      which requests a fresh transcode session from Jellyfin with `AudioStreamIndex`.
 *
 * 6. Error Handling:
 *    - Authentication failures and missing keys throw `JellyfinApiKeyException` (subclass of `OttException`),
 *      preventing WebSocket client disconnections while delivering clear, actionable feedback to users.
 */

import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import path from "node:path";
import type { LookupFunction } from "node:net";
import type express from "express";
import axios, { type AxiosInstance } from "axios";
import type {
	Video,
	VideoAudioTrack,
	VideoMetadata,
	VideoService,
	VideoSubtitle,
} from "ott-common/models/video.js";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import { ServiceAdapter, type VideoRequest } from "../serviceadapter.js";
import { redisClient } from "../redisclient.js";
import {
	BadApiArgumentException,
	InvalidVideoIdException,
	JellyfinApiKeyException,
	ServiceLinkParseException,
} from "../exceptions.js";

const log = getLogger("jellyfin");

const JELLYFIN_WEB_URL_REGEX = /\/web(?:\/index\.html)?\/?#!?\/details\?id=/;
const JELLYFIN_ITEMS_URL_REGEX = /\/Items\/[^/]+\/Download/;
const JELLYFIN_HLS_URL_REGEX = /\/Videos\/[^/]+\/(?:master|main)\.m3u8/;
const JELLYFIN_ID_PARAM_REGEX = /[?&]id=([^&#]+)/;
const TRAILING_SLASHES_REGEX = /\/+$/;
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const RELATIVE_TRAVERSAL_PREFIX_REGEX = /^(\.\.(\/|\\|$))+/;
const ALLOWED_STREAM_EXTENSIONS_REGEX = /\.(m3u8|ts|mp4|m4s|aac|mp3)$/i;
const COMPOUND_ID_SEPARATOR = "::";

export interface StoredJellyfinCredential {
	apiKey: string;
	serverOrigin: string;
	itemId: string;
}

interface JellyfinMediaStream {
	Type: string;
	Index: number;
	Codec?: string;
	Language?: string;
	Title?: string;
	DisplayTitle?: string;
	IsDefault?: boolean;
	IsExternal?: boolean;
	IsTextSubtitleStream?: boolean;
	SupportsExternalStream?: boolean;
	DeliveryUrl?: string;
}

interface JellyfinMediaSource {
	Id?: string;
	TranscodingUrl?: string;
	MediaStreams: JellyfinMediaStream[];
}

interface JellyfinPlaybackInfo {
	MediaSources: JellyfinMediaSource[];
}

interface JellyfinItem {
	Id: string;
	Name: string;
	Type: string;
	RunTimeTicks?: number;
	Overview?: string;
	IndexNumber?: number;
	ParentIndexNumber?: number;
	SeriesName?: string;
	ParentId?: string;
	ImageTags?: { Primary?: string };
}

interface JellyfinUser {
	Id: string;
	Name: string;
}

interface JellyfinEpisodesResponse {
	Items: JellyfinItem[];
}

export default class JellyfinAdapter extends ServiceAdapter {
	private credentialCache: Map<string, StoredJellyfinCredential> = new Map();
	private userIdCache: Map<string, string> = new Map();
	private allowedHosts: string[] = [];
	private clientHeaders: Record<string, string> = {
		"X-Emby-Client": "OpenTogetherTube",
		"X-Emby-Device": "Computer",
		"X-Emby-Device-Id": "opentogethertube",
		"X-Emby-Version": "10.0.0",
	};
	api: AxiosInstance;

	constructor() {
		super();
		const lookup = this.createSafeLookup();
		this.api = axios.create({
			headers: {
				"User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}`,
				...this.clientHeaders,
			},
			httpAgent: new http.Agent({ lookup }),
			httpsAgent: new https.Agent({ lookup }),
			maxRedirects: 0,
		});
	}

	get serviceId(): VideoService {
		return "jellyfin";
	}

	get isCacheSafe(): boolean {
		return false;
	}

	async initialize(): Promise<void> {
		const configured = conf.get("info_extractor.jellyfin.instances");
		this.allowedHosts = Array.isArray(configured)
			? configured.map((h: string) => h.toLowerCase())
			: [];
	}

	setAllowedHosts(hosts: string[]): void {
		this.allowedHosts = hosts.map(h => h.toLowerCase());
	}

	private createSafeLookup(): LookupFunction {
		return (hostname, options, callback) => {
			const hostLower = hostname.toLowerCase();
			if (this.allowedHosts.includes(hostLower)) {
				return dns.lookup(hostname, options as any, callback as any);
			}

			if (this.isPrivateOrLocalHost(hostLower)) {
				return callback(
					new Error(`Access to private/local host '${hostname}' is not permitted`),
					"",
					4,
				);
			}

			dns.lookup(hostname, options as any, (err, address, family) => {
				if (err) {
					return callback(err, address as any, family as any);
				}
				const addresses = Array.isArray(address)
					? address
					: [{ address: address as string, family: family as number }];
				for (const item of addresses) {
					if (this.isPrivateOrLocalHost(item.address)) {
						return callback(
							new Error(
								`Resolved destination '${hostname}' (${item.address}) is a private/local address`,
							),
							"",
							item.family,
						);
					}
				}
				return callback(null, address as any, family as any);
			});
		};
	}

	private isPrivateOrLocalHost(hostname: string): boolean {
		const lower = hostname.toLowerCase().trim();
		if (
			lower === "localhost" ||
			lower.endsWith(".localhost") ||
			lower.endsWith(".local") ||
			lower.endsWith(".internal") ||
			lower === "0.0.0.0" ||
			lower === "::" ||
			lower === "::1" ||
			lower === "[::1]"
		) {
			return true;
		}

		let ipv4Str = lower;
		if (ipv4Str.startsWith("::ffff:")) {
			ipv4Str = ipv4Str.substring(7);
		}

		const ipv4Match = IPV4_REGEX.exec(ipv4Str);
		if (ipv4Match) {
			const b0 = Number.parseInt(ipv4Match[1], 10);
			const b1 = Number.parseInt(ipv4Match[2], 10);
			const b2 = Number.parseInt(ipv4Match[3], 10);
			const b3 = Number.parseInt(ipv4Match[4], 10);

			if (b0 > 255 || b1 > 255 || b2 > 255 || b3 > 255) {
				return true;
			}
			// 0.0.0.0/8
			if (b0 === 0) {
				return true;
			}
			// 10.0.0.0/8
			if (b0 === 10) {
				return true;
			}
			// 100.64.0.0/10 (Carrier-Grade NAT)
			if (b0 === 100 && b1 >= 64 && b1 <= 127) {
				return true;
			}
			// 127.0.0.0/8 (Loopback)
			if (b0 === 127) {
				return true;
			}
			// 169.254.0.0/16 (Link-Local)
			if (b0 === 169 && b1 === 254) {
				return true;
			}
			// 172.16.0.0/12 (Private)
			if (b0 === 172 && b1 >= 16 && b1 <= 31) {
				return true;
			}
			// 192.168.0.0/16 (Private)
			if (b0 === 192 && b1 === 168) {
				return true;
			}
			// 192.0.0.0/24 (IETF Protocol Assignments)
			if (b0 === 192 && b1 === 0 && b2 === 0) {
				return true;
			}
			// 192.0.2.0/24 (TEST-NET-1)
			if (b0 === 192 && b1 === 0 && b2 === 2) {
				return true;
			}
			// 198.51.100.0/24 (TEST-NET-2)
			if (b0 === 198 && b1 === 51 && b2 === 100) {
				return true;
			}
			// 203.0.113.0/24 (TEST-NET-3)
			if (b0 === 203 && b1 === 0 && b2 === 113) {
				return true;
			}
			// 224.0.0.0/4 (Multicast)
			if (b0 >= 224 && b0 <= 239) {
				return true;
			}
			// 240.0.0.0/4 (Reserved)
			if (b0 >= 240) {
				return true;
			}
			// 255.255.255.255 (Broadcast)
			if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) {
				return true;
			}
		}

		if (
			lower.startsWith("fe8") ||
			lower.startsWith("fe9") ||
			lower.startsWith("fea") ||
			lower.startsWith("feb") ||
			lower.startsWith("fc") ||
			lower.startsWith("fd")
		) {
			return true;
		}

		return false;
	}

	validateDestination(serverOrigin: string): void {
		let url: URL;
		try {
			url = new URL(serverOrigin);
		} catch {
			throw new BadApiArgumentException("id", "Invalid server origin URL");
		}

		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new BadApiArgumentException("id", "Server origin must use HTTP or HTTPS");
		}

		const hostLower = url.host.toLowerCase();
		const hostnameLower = url.hostname.toLowerCase();

		if (this.allowedHosts.length > 0) {
			if (
				!this.allowedHosts.includes(hostnameLower) &&
				!this.allowedHosts.includes(hostLower)
			) {
				throw new BadApiArgumentException(
					"id",
					`Host '${url.host}' is not in the allowed Jellyfin instances`,
				);
			}
		} else if (this.isPrivateOrLocalHost(hostnameLower)) {
			throw new BadApiArgumentException(
				"id",
				`Requests to internal or loopback host '${url.hostname}' are not permitted`,
			);
		}
	}

	canHandleURL(link: string): boolean {
		try {
			const url = new URL(link);
			this.validateDestination(url.origin);
			return (
				JELLYFIN_WEB_URL_REGEX.test(url.href) ||
				JELLYFIN_ITEMS_URL_REGEX.test(url.pathname) ||
				JELLYFIN_HLS_URL_REGEX.test(url.pathname)
			);
		} catch {
			return false;
		}
	}

	isCollectionURL(url: string): boolean {
		return JELLYFIN_WEB_URL_REGEX.test(url);
	}

	private storeApiKey(
		tokenRef: string,
		apiKey: string,
		serverOrigin: string,
		itemId: string,
	): void {
		const cred: StoredJellyfinCredential = { apiKey, serverOrigin, itemId };
		this.credentialCache.set(tokenRef, cred);
		if (redisClient) {
			const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
			redisClient
				.setEx(`jellyfin:token:${tokenRef}`, TTL_SECONDS, JSON.stringify(cred))
				.catch(err => log.warn(`Failed to persist Jellyfin token in redis: ${err}`));
		}
	}

	async retrieveCredential(tokenRef: string): Promise<StoredJellyfinCredential | null> {
		const cached = this.credentialCache.get(tokenRef);
		if (cached) {
			return cached;
		}

		if (redisClient) {
			try {
				const redisVal = await redisClient.get(`jellyfin:token:${tokenRef}`);
				if (redisVal) {
					try {
						const parsed = JSON.parse(redisVal) as StoredJellyfinCredential;
						if (parsed.apiKey && parsed.serverOrigin && parsed.itemId) {
							this.credentialCache.set(tokenRef, parsed);
							return parsed;
						}
					} catch {
						// Malformed value
					}
				}
			} catch (err) {
				log.warn(`Failed to read Jellyfin token from redis: ${err}`);
			}
		}

		return null;
	}

	private async retrieveApiKey(
		tokenRefOrKey: string | null,
		serverOrigin: string,
		itemId: string,
	): Promise<string> {
		if (!tokenRefOrKey) {
			return "";
		}

		const cred = await this.retrieveCredential(tokenRefOrKey);
		if (!cred) {
			return "";
		}

		if (cred.serverOrigin !== serverOrigin || cred.itemId !== itemId) {
			throw new BadApiArgumentException(
				"id",
				`Token reference is not authorized for origin '${serverOrigin}' or item '${itemId}'`,
			);
		}

		return cred.apiKey;
	}

	getVideoId(url: string): string {
		try {
			const parsed = new URL(url);
			const apiKey = this.extractApiKey(parsed);

			let itemId: string | null = null;

			const webMatch = url.match(JELLYFIN_ID_PARAM_REGEX);
			if (webMatch) {
				itemId = webMatch[1];
			} else if (JELLYFIN_ITEMS_URL_REGEX.test(parsed.pathname)) {
				const pathParts = parsed.pathname.split("/");
				const itemsIndex = pathParts.indexOf("Items");
				if (itemsIndex >= 0 && itemsIndex + 1 < pathParts.length) {
					itemId = pathParts[itemsIndex + 1];
				}
			} else if (JELLYFIN_HLS_URL_REGEX.test(parsed.pathname)) {
				const pathParts = parsed.pathname.split("/");
				const videosIndex = pathParts.indexOf("Videos");
				if (videosIndex >= 0 && videosIndex + 1 < pathParts.length) {
					itemId = pathParts[videosIndex + 1];
				}
			}

			if (!itemId) {
				throw new ServiceLinkParseException(this.serviceId, url);
			}

			let basePath = "";
			const webIndex = parsed.pathname.indexOf("/web");
			const itemsIndex = parsed.pathname.indexOf("/Items");
			const videosIndex = parsed.pathname.indexOf("/Videos");

			if (webIndex !== -1 && JELLYFIN_WEB_URL_REGEX.test(url)) {
				basePath = parsed.pathname.substring(0, webIndex);
			} else if (itemsIndex !== -1 && JELLYFIN_ITEMS_URL_REGEX.test(parsed.pathname)) {
				basePath = parsed.pathname.substring(0, itemsIndex);
			} else if (videosIndex !== -1 && JELLYFIN_HLS_URL_REGEX.test(parsed.pathname)) {
				basePath = parsed.pathname.substring(0, videosIndex);
			}
			basePath = basePath.replace(TRAILING_SLASHES_REGEX, "");
			const serverOrigin = `${parsed.origin}${basePath}`;

			this.validateDestination(serverOrigin);

			if (apiKey) {
				const tokenRef = randomUUID();
				this.storeApiKey(tokenRef, apiKey, serverOrigin, itemId);
				return `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}${COMPOUND_ID_SEPARATOR}${tokenRef}`;
			}
			return `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;
		} catch (e) {
			if (e instanceof ServiceLinkParseException) {
				throw e;
			}
			if (e instanceof BadApiArgumentException) {
				throw e;
			}
			throw new ServiceLinkParseException(this.serviceId, url);
		}
	}

	private extractApiKey(url: URL): string | null {
		const apiKey =
			url.searchParams.get("api_key") ??
			url.searchParams.get("apikey") ??
			url.searchParams.get("apiKey");
		if (apiKey) {
			return apiKey;
		}

		const hashIndex = url.href.indexOf("#");
		if (hashIndex !== -1) {
			const hashPart = url.href.substring(hashIndex + 1);
			const hashParams = new URLSearchParams(hashPart);
			return (
				hashParams.get("api_key") ?? hashParams.get("apikey") ?? hashParams.get("apiKey")
			);
		}

		return null;
	}

	private async getUserId(serverOrigin: string, apiKey: string): Promise<string> {
		const cacheKey = `${serverOrigin}::${apiKey}`;
		const cached = this.userIdCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		try {
			const meResp = await this.api.get(`${serverOrigin}/Users/Me`, {
				headers: this.buildAuthHeaders(apiKey),
			});
			if (meResp.data?.Id) {
				const userId = meResp.data.Id;
				this.userIdCache.set(cacheKey, userId);
				return userId;
			}
		} catch {
			// Server API keys do not have a dedicated user owner; fall back to /Users
		}

		const usersResp = await this.api.get(`${serverOrigin}/Users`, {
			headers: this.buildAuthHeaders(apiKey),
		});
		const users = usersResp.data as JellyfinUser[];
		if (!users || users.length === 0) {
			throw new Error(`No users found on Jellyfin server at ${serverOrigin}`);
		}
		const userId = users[0].Id;
		this.userIdCache.set(cacheKey, userId);
		return userId;
	}

	private buildAuthHeaders(apiKey: string): Record<string, string> {
		return {
			...this.clientHeaders,
			"X-Emby-Token": apiKey,
		};
	}

	async fetchVideoInfo(id: string, _properties?: (keyof VideoMetadata)[]): Promise<Video> {
		const { serverOrigin, itemId, apiKey, tokenRef } = await this.parseCompoundId(id);
		this.ensureApiKey(apiKey, serverOrigin);

		let userId: string;
		try {
			userId = await this.getUserId(serverOrigin, apiKey);
		} catch (e) {
			throw this.toAuthError(e, serverOrigin);
		}

		const itemResp = await this.api.get(`${serverOrigin}/Users/${userId}/Items/${itemId}`, {
			headers: this.buildAuthHeaders(apiKey),
		});
		const item = itemResp.data as JellyfinItem;

		let playbackData: JellyfinPlaybackInfo | undefined;
		try {
			playbackData = await this.fetchPlaybackInfo(
				serverOrigin,
				itemId,
				apiKey,
				undefined,
				undefined,
				userId,
			);
		} catch (e) {
			if (axios.isAxiosError(e) && e.response?.status === 401) {
				throw this.toAuthError(e, serverOrigin);
			}
			log.warn(`Failed to fetch playback info for ${itemId}: ${e}`);
		}
		const mediaSource = playbackData?.MediaSources?.[0];
		const mediaSourceId = mediaSource?.Id ?? itemId;
		const transcodingUrl = mediaSource?.TranscodingUrl;

		let streamUrl: string;
		if (transcodingUrl) {
			streamUrl = this.buildProxiedStreamUrl(tokenRef, transcodingUrl);
		} else {
			streamUrl = this.constructStreamUrl(tokenRef, mediaSourceId);
		}

		let subtitleUrl: string | undefined;
		let availableSubtitles: VideoSubtitle[] | undefined;
		let availableAudioTracks: VideoAudioTrack[] | undefined;
		if (mediaSource) {
			const audioTracks = this.extractAudioTracks(mediaSource);
			if (audioTracks.length > 0) {
				availableAudioTracks = audioTracks;
			}

			const subtitleStreams = (mediaSource.MediaStreams ?? []).filter(
				s => s.Type === "Subtitle" && this.isDeliverableSubtitle(s),
			);

			if (subtitleStreams.length > 0) {
				availableSubtitles = subtitleStreams.map(stream => {
					const subtitleUrl = this.constructSubtitleUrl(
						tokenRef,
						mediaSourceId,
						stream.Index,
					);
					const label =
						stream.DisplayTitle ??
						stream.Title ??
						stream.Language ??
						`Subtitle ${stream.Index}`;
					return {
						url: subtitleUrl,
						label,
						language: stream.Language,
					};
				});

				const englishIndex = availableSubtitles.findIndex(
					s => s.language === "eng" || s.language === "en",
				);
				const defaultIndex = englishIndex >= 0 ? englishIndex : 0;
				subtitleUrl = availableSubtitles[defaultIndex]?.url;
			}
		}

		const title = this.constructTitle(item);
		const length = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10_000_000) : 0;
		const thumbnail = item.ImageTags?.Primary
			? `${serverOrigin}/Items/${itemId}/Images/Primary`
			: "";

		return {
			service: "jellyfin",
			id,
			title,
			description: item.Overview ?? "",
			length,
			thumbnail,
			mime: "application/x-mpegURL",
			hls_url: streamUrl,
			subtitleUrl,
			availableSubtitles,
			availableAudioTracks,
		};
	}

	private async fetchPlaybackInfo(
		serverOrigin: string,
		itemId: string,
		apiKey: string,
		audioStreamIndex?: number,
		mediaSourceId?: string,
		userId?: string,
	): Promise<JellyfinPlaybackInfo> {
		const body: Record<string, unknown> = {
			StartTimeTicks: 0,
			IsPlayback: true,
			AutoOpenLiveStream: true,
			AlwaysBurnInSubtitleWhenTranscoding: false,
			DeviceProfile: {
				Name: "OpenTogetherTube",
				TranscodingProfiles: [
					{
						Container: "ts",
						Type: "Video",
						VideoCodec: "h264",
						AudioCodec: "aac",
						Protocol: "hls",
					},
				],
				SubtitleProfiles: [
					{ Format: "vtt", Method: "External" },
					{ Format: "webvtt", Method: "External" },
				],
			},
		};
		if (mediaSourceId) {
			body.MediaSourceId = mediaSourceId;
		}
		if (audioStreamIndex !== undefined) {
			body.AudioStreamIndex = audioStreamIndex;
		}
		const url = userId
			? `${serverOrigin}/Items/${itemId}/PlaybackInfo?userId=${encodeURIComponent(userId)}`
			: `${serverOrigin}/Items/${itemId}/PlaybackInfo`;
		const resp = await this.api.post(url, body, {
			headers: this.buildAuthHeaders(apiKey),
		});
		return resp.data as JellyfinPlaybackInfo;
	}

	async getRefreshedStream(
		id: string,
		audioStreamIndex?: number,
	): Promise<{ hls_url: string; playbackType: "hls" }> {
		const { serverOrigin, itemId, apiKey, tokenRef } = await this.parseCompoundId(id);
		this.ensureApiKey(apiKey, serverOrigin);

		if (audioStreamIndex !== undefined) {
			if (!Number.isInteger(audioStreamIndex) || audioStreamIndex < 0) {
				throw new BadApiArgumentException(
					"audioStreamIndex",
					"audioStreamIndex must be a non-negative integer",
				);
			}
		}

		let userId: string;
		try {
			userId = await this.getUserId(serverOrigin, apiKey);
		} catch (e) {
			throw this.toAuthError(e, serverOrigin);
		}

		let mediaSourceId = itemId;
		let playbackData: JellyfinPlaybackInfo | undefined;
		try {
			const basePlayback = await this.fetchPlaybackInfo(
				serverOrigin,
				itemId,
				apiKey,
				undefined,
				undefined,
				userId,
			);
			const baseSource = basePlayback?.MediaSources?.[0];
			if (baseSource?.Id) {
				mediaSourceId = baseSource.Id;
			}
			if (audioStreamIndex !== undefined) {
				playbackData = await this.fetchPlaybackInfo(
					serverOrigin,
					itemId,
					apiKey,
					audioStreamIndex,
					mediaSourceId,
					userId,
				);
			} else {
				playbackData = basePlayback;
			}
		} catch (e) {
			throw this.toAuthError(e, serverOrigin);
		}

		const mediaSource = playbackData?.MediaSources?.[0];
		const resolvedMediaSourceId = mediaSource?.Id ?? mediaSourceId;
		const transcodingUrl = mediaSource?.TranscodingUrl;

		let streamUrl: string;
		if (transcodingUrl) {
			streamUrl = this.buildProxiedStreamUrl(tokenRef, transcodingUrl);
		} else {
			streamUrl = this.constructStreamUrl(tokenRef, resolvedMediaSourceId, audioStreamIndex);
		}

		return {
			hls_url: streamUrl,
			playbackType: "hls",
		};
	}

	private extractAudioTracks(mediaSource: JellyfinMediaSource): VideoAudioTrack[] {
		const audioStreams = (mediaSource.MediaStreams ?? []).filter(s => s.Type === "Audio");
		return audioStreams.map(stream => {
			const label =
				stream.DisplayTitle ?? stream.Title ?? stream.Language ?? `Audio ${stream.Index}`;
			return {
				index: stream.Index,
				label,
				language: stream.Language,
				codec: stream.Codec,
				isDefault: stream.IsDefault,
			};
		});
	}

	async resolveURL(url: string): Promise<Video[]> {
		const compoundId = this.getVideoId(url);
		const { serverOrigin, itemId, apiKey } = await this.parseCompoundId(compoundId);
		this.ensureApiKey(apiKey, serverOrigin);

		let userId: string;
		try {
			userId = await this.getUserId(serverOrigin, apiKey);
		} catch (e) {
			throw this.toAuthError(e, serverOrigin);
		}

		const itemResp = await this.api.get(`${serverOrigin}/Users/${userId}/Items/${itemId}`, {
			headers: this.buildAuthHeaders(apiKey),
		});
		const item = itemResp.data as JellyfinItem;

		const epCompoundIdFor = (epId: string): string => {
			if (!apiKey) {
				return `${serverOrigin}${COMPOUND_ID_SEPARATOR}${epId}`;
			}
			const epTokenRef = randomUUID();
			this.storeApiKey(epTokenRef, apiKey, serverOrigin, epId);
			return `${serverOrigin}${COMPOUND_ID_SEPARATOR}${epId}${COMPOUND_ID_SEPARATOR}${epTokenRef}`;
		};
		const fetchEpisode = async (epId: string): Promise<Video | null> => {
			const epCompoundId = epCompoundIdFor(epId);
			try {
				return await this.fetchVideoInfo(epCompoundId);
			} catch (e) {
				log.warn(`Failed to fetch episode ${epId}: ${e}`);
				return null;
			}
		};

		if (item.Type === "Series") {
			const episodesResp = await this.api.get(`${serverOrigin}/Shows/${itemId}/Episodes`, {
				headers: this.buildAuthHeaders(apiKey),
			});
			const episodesData = episodesResp.data as JellyfinEpisodesResponse;
			const episodes = episodesData.Items ?? [];

			const videos: Video[] = [];
			for (const ep of episodes) {
				const video = await fetchEpisode(ep.Id);
				if (video) {
					videos.push(video);
				}
			}
			return videos;
		} else if (item.Type === "Season") {
			const seriesId = item.ParentId;
			const episodesResp = await this.api.get(`${serverOrigin}/Shows/${seriesId}/Episodes`, {
				params: { SeasonId: itemId },
				headers: this.buildAuthHeaders(apiKey),
			});
			const episodesData = episodesResp.data as JellyfinEpisodesResponse;
			const episodes = episodesData.Items ?? [];

			const videos: Video[] = [];
			for (const ep of episodes) {
				const video = await fetchEpisode(ep.Id);
				if (video) {
					videos.push(video);
				}
			}
			return videos;
		} else {
			const video = await this.fetchVideoInfo(compoundId);
			return [video];
		}
	}

	private async parseCompoundId(id: string): Promise<{
		serverOrigin: string;
		itemId: string;
		apiKey: string;
		tokenRef: string;
	}> {
		// serverOrigin contains "://" but never "::", so a plain split is safe.
		const parts = id.split(COMPOUND_ID_SEPARATOR);
		if (parts.length < 2) {
			throw new InvalidVideoIdException(this.serviceId, id);
		}
		const serverOrigin = parts[0];
		const itemId = parts[1];

		this.validateDestination(serverOrigin);

		const tokenRefOrKey = parts.length >= 3 ? parts[2] : null;
		const apiKey = await this.retrieveApiKey(tokenRefOrKey, serverOrigin, itemId);
		return {
			serverOrigin,
			itemId,
			apiKey,
			tokenRef: tokenRefOrKey ?? "",
		};
	}

	private ensureApiKey(apiKey: string, serverOrigin: string): void {
		if (!apiKey) {
			throw new JellyfinApiKeyException(
				`Missing API key for Jellyfin server at ${serverOrigin}. ` +
					`Include it in the URL you add (e.g. append ?api_key=YOUR_KEY).`,
			);
		}
	}

	async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
		const videos: Video[] = [];
		let keyError: JellyfinApiKeyException | undefined;
		for (const req of requests) {
			try {
				videos.push(await this.fetchVideoInfo(req.id, req.missingInfo));
			} catch (e) {
				if (e instanceof JellyfinApiKeyException) {
					keyError ??= e;
				} else {
					log.warn(
						`fetchManyVideoInfo: failed to fetch jellyfin:${req.id}: ${e}, skipping`,
					);
				}
			}
		}
		// If nothing succeeded and credentials were the problem, surface that
		// instead of letting callers report a misleading empty result.
		if (videos.length === 0 && keyError) {
			throw keyError;
		}
		return videos;
	}

	private toAuthError(e: unknown, serverOrigin: string): Error {
		if (axios.isAxiosError(e) && e.response?.status === 401) {
			return new JellyfinApiKeyException(
				`Unauthorized by Jellyfin server at ${serverOrigin}. ` +
					`The API key is invalid or expired; re-add the video with a valid ?api_key= value.`,
			);
		}
		return e instanceof Error ? e : new Error(String(e));
	}

	private constructStreamUrl(
		tokenRef: string,
		mediaSourceId: string,
		audioStreamIndex?: number,
	): string {
		const params = new URLSearchParams();
		params.set("MediaSourceId", mediaSourceId);
		params.set("AudioCodec", "aac");
		if (audioStreamIndex !== undefined) {
			params.set("AudioStreamIndex", audioStreamIndex.toString());
		}
		const playSessionId = randomUUID().replace(/-/g, "");
		params.set("PlaySessionId", playSessionId);
		return `/api/data/jellyfin/stream/${tokenRef}/master.m3u8?${params.toString()}`;
	}

	private buildProxiedStreamUrl(tokenRef: string, transcodingUrl: string): string {
		const queryIndex = transcodingUrl.indexOf("?");
		let query = "";
		let subpath = "master.m3u8";
		if (queryIndex !== -1) {
			const pathPart = transcodingUrl.substring(0, queryIndex);
			const fileName = pathPart.split("/").pop();
			if (fileName && fileName.endsWith(".m3u8")) {
				subpath = fileName;
			}
			const searchParams = new URLSearchParams(transcodingUrl.substring(queryIndex + 1));
			searchParams.delete("api_key");
			searchParams.delete("ApiKey");
			searchParams.delete("apikey");
			const qs = searchParams.toString();
			query = qs ? `?${qs}` : "";
		}
		return `/api/data/jellyfin/stream/${tokenRef}/${subpath}${query}`;
	}

	private constructSubtitleUrl(tokenRef: string, mediaSourceId: string, index: number): string {
		return `/api/data/jellyfin/subtitles/${tokenRef}/${mediaSourceId}/${index}/stream.vtt`;
	}

	async proxyStream(
		tokenRef: string,
		subpath: string,
		query: Record<string, any>,
		req: express.Request,
		res: express.Response,
	): Promise<void> {
		const cred = await this.retrieveCredential(tokenRef);
		if (!cred) {
			res.status(404).send("Stream session not found or expired");
			return;
		}

		this.validateDestination(cred.serverOrigin);

		const cleanSubpath = path.posix
			.normalize(subpath || "")
			.replace(RELATIVE_TRAVERSAL_PREFIX_REGEX, "");
		if (
			cleanSubpath.includes("..") ||
			cleanSubpath.startsWith("/") ||
			!cleanSubpath.match(ALLOWED_STREAM_EXTENSIONS_REGEX)
		) {
			res.status(400).send("Invalid stream path");
			return;
		}

		const params = new URLSearchParams();
		for (const [key, val] of Object.entries(query)) {
			if (typeof val === "string") {
				params.set(key, val);
			}
		}
		params.set("api_key", cred.apiKey);

		const targetUrl = `${cred.serverOrigin}/Videos/${cred.itemId}/${cleanSubpath}?${params.toString()}`;
		const headers: Record<string, string> = {
			...this.buildAuthHeaders(cred.apiKey),
		};
		if (req.headers.range) {
			headers.range = req.headers.range;
		}

		try {
			const upstream = await this.api.get(targetUrl, {
				headers,
				responseType: "stream",
				validateStatus: status => status < 500,
			});

			res.status(upstream.status);
			res.setHeader("Cache-Control", "private, no-store");

			if (cleanSubpath.endsWith(".m3u8")) {
				const chunks: Buffer[] = [];
				for await (const chunk of upstream.data) {
					chunks.push(Buffer.from(chunk));
				}
				let manifest = Buffer.concat(chunks).toString("utf-8");
				manifest = manifest.replace(/([?&])(?:api_key|ApiKey|apikey)=[^&\s"\n\r]+/gi, "$1");
				manifest = manifest.replace(/\?&/g, "?").replace(/[?&](\s|$)/gm, "$1");
				res.setHeader("Content-Type", "application/x-mpegURL");
				res.send(manifest);
				return;
			}

			if (upstream.headers["content-type"]) {
				res.setHeader("Content-Type", upstream.headers["content-type"]);
			}
			if (upstream.headers["content-length"]) {
				res.setHeader("Content-Length", upstream.headers["content-length"]);
			}
			if (upstream.headers["content-range"]) {
				res.setHeader("Content-Range", upstream.headers["content-range"]);
			}
			if (upstream.headers["accept-ranges"]) {
				res.setHeader("Accept-Ranges", upstream.headers["accept-ranges"]);
			}
			upstream.data.pipe(res);
		} catch (err: any) {
			log.warn(`proxyStream: failed to fetch ${cleanSubpath} from Jellyfin: ${err}`);
			if (!res.headersSent) {
				res.status(502).send("Bad Gateway");
			}
		}
	}

	async proxySubtitle(
		tokenRef: string,
		mediaSourceId: string,
		index: number,
		res: express.Response,
	): Promise<void> {
		const cred = await this.retrieveCredential(tokenRef);
		if (!cred) {
			res.status(404).send("Subtitle not found or expired");
			return;
		}

		this.validateDestination(cred.serverOrigin);

		const targetUrl = `${cred.serverOrigin}/Videos/${cred.itemId}/${encodeURIComponent(mediaSourceId)}/Subtitles/${index}/0/Stream.vtt?api_key=${encodeURIComponent(cred.apiKey)}`;
		try {
			const upstream = await this.api.get(targetUrl, {
				headers: this.buildAuthHeaders(cred.apiKey),
				responseType: "stream",
				validateStatus: status => status < 500,
			});

			res.status(upstream.status);
			res.setHeader("Content-Type", "text/vtt");
			res.setHeader("Cache-Control", "private, no-store");
			upstream.data.pipe(res);
		} catch (err: any) {
			log.warn(`proxySubtitle: failed to fetch subtitle from Jellyfin: ${err}`);
			if (!res.headersSent) {
				res.status(502).send("Bad Gateway");
			}
		}
	}

	private isDeliverableSubtitle(stream: JellyfinMediaStream): boolean {
		return !!(stream.IsTextSubtitleStream && stream.SupportsExternalStream);
	}

	private constructTitle(item: JellyfinItem): string {
		if (item.Type === "Episode" && item.SeriesName) {
			const seasonNum = item.ParentIndexNumber ?? 0;
			const episodeNum = item.IndexNumber ?? 0;
			return `${item.SeriesName} - S${String(seasonNum).padStart(2, "0")}E${String(
				episodeNum,
			).padStart(2, "0")}`;
		}
		return item.Name;
	}
}
