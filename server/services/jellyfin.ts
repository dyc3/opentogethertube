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

import axios from "axios";
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
import {
	BadApiArgumentException,
	JellyfinApiKeyException,
	ServiceLinkParseException,
} from "../exceptions.js";

const log = getLogger("jellyfin");

const JELLYFIN_WEB_URL_REGEX = /\/web(?:\/index\.html)?\/?#!?\/details\?id=/;
const JELLYFIN_ITEMS_URL_REGEX = /\/Items\/[^/]+\/Download/;
const JELLYFIN_HLS_URL_REGEX = /\/Videos\/[^/]+\/(?:master|main)\.m3u8/;
const JELLYFIN_ID_PARAM_REGEX = /[?&]id=([^&#]+)/;
const TRAILING_SLASHES_REGEX = /\/+$/;
const LEADING_SLASH_REGEX = /^\//;
const COMPOUND_ID_SEPARATOR = "::";

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

// Subtitle codecs Jellyfin can convert to VTT for external delivery.
// Image-based formats (pgs, dvbsub, dvdsub) cannot be converted.
const CONVERTIBLE_SUBTITLE_CODECS = ["srt", "subrip", "ass", "ssa", "vtt"];

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
	Images?: { Primary?: string };
}

interface JellyfinUser {
	Id: string;
	Name: string;
}

interface JellyfinEpisodesResponse {
	Items: JellyfinItem[];
}

export default class JellyfinAdapter extends ServiceAdapter {
	private apiKeyCache: Map<string, string> = new Map();
	private userIdCache: Map<string, string> = new Map();
	private allowedHosts: string[] = [];
	private clientHeaders: Record<string, string> = {
		"X-Emby-Client": "OpenTogetherTube",
		"X-Emby-Device": "Computer",
		"X-Emby-Device-Id": "opentogethertube",
		"X-Emby-Version": "10.0.0",
	};
	api = axios.create({
		headers: {
			"User-Agent": `OpenTogetherTube @ ${conf.get("hostname")}`,
			...this.clientHeaders,
		},
	});

	get serviceId(): VideoService {
		return "jellyfin";
	}

	get isCacheSafe(): boolean {
		return false;
	}

	async initialize(): Promise<void> {
		this.allowedHosts = conf.get("info_extractor.jellyfin.instances");
	}

	canHandleURL(link: string): boolean {
		try {
			const url = new URL(link);
			if (!url.protocol.startsWith("http")) {
				return false;
			}
			if (this.allowedHosts.length > 0 && !this.allowedHosts.includes(url.host)) {
				return false;
			}
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

			// Embed the API key in the compound ID so it survives server restarts
			// (the in-memory cache alone is wiped on restart, causing 401s later).
			const compoundId = apiKey
				? `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}${COMPOUND_ID_SEPARATOR}${apiKey}`
				: `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;
			if (apiKey) {
				this.apiKeyCache.set(compoundId, apiKey);
			}
			return compoundId;
		} catch (e) {
			if (e instanceof ServiceLinkParseException) {
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
		const { serverOrigin, itemId, apiKey } = this.parseCompoundId(id);
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
			streamUrl = this.withApiKey(
				this.resolveServerUrl(serverOrigin, transcodingUrl),
				apiKey,
			);
		} else {
			streamUrl = this.constructStreamUrl(serverOrigin, mediaSourceId, apiKey);
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
					const subtitleUrl = stream.DeliveryUrl
						? this.resolveDeliveryUrl(serverOrigin, stream.DeliveryUrl, apiKey)
						: this.constructSubtitleUrl(
								serverOrigin,
								itemId,
								mediaSourceId,
								apiKey,
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
		const thumbnail = item.Images?.Primary
			? `${serverOrigin}/Items/${itemId}/Images/Primary?api_key=${apiKey}`
			: "";

		const compoundId = apiKey
			? `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}${COMPOUND_ID_SEPARATOR}${apiKey}`
			: `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;
		return {
			service: "jellyfin",
			id: compoundId,
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
						VideoCodec: "h264,hevc",
						AudioCodec: "aac",
						Protocol: "hls",
					},
				],
				SubtitleProfiles: [
					{ Format: "vtt", Method: "External" },
					{ Format: "webvtt", Method: "External" }
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
		const { serverOrigin, itemId, apiKey } = this.parseCompoundId(id);
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
			streamUrl = this.withApiKey(
				this.resolveServerUrl(serverOrigin, transcodingUrl),
				apiKey,
			);
		} else {
			streamUrl = this.constructStreamUrl(
				serverOrigin,
				resolvedMediaSourceId,
				apiKey,
				audioStreamIndex,
			);
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

	private resolveServerUrl(serverOrigin: string, url: string): string {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			return url;
		}
		const base = new URL(serverOrigin);
		if (base.pathname && base.pathname !== "/" && url.startsWith(base.pathname)) {
			return `${base.origin}${url.startsWith("/") ? "" : "/"}${url}`;
		}
		return `${serverOrigin.replace(TRAILING_SLASHES_REGEX, "")}/${url.replace(
			LEADING_SLASH_REGEX,
			"",
		)}`;
	}

	private withApiKey(url: string, apiKey: string): string {
		if (!apiKey) {
			return url;
		}
		const parsed = new URL(url);
		const hasKey = [...parsed.searchParams.keys()].some(
			k => k.toLowerCase() === "api_key" || k.toLowerCase() === "apikey",
		);
		if (!hasKey) {
			parsed.searchParams.set("api_key", apiKey);
		}
		return parsed.toString();
	}

	async resolveURL(url: string): Promise<Video[]> {
		const compoundId = this.getVideoId(url);
		const { serverOrigin, itemId, apiKey } = this.parseCompoundId(compoundId);
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

		const epCompoundIdFor = (epId: string): string =>
			apiKey
				? `${serverOrigin}${COMPOUND_ID_SEPARATOR}${epId}${COMPOUND_ID_SEPARATOR}${apiKey}`
				: `${serverOrigin}${COMPOUND_ID_SEPARATOR}${epId}`;
		const fetchEpisode = async (epId: string): Promise<Video | null> => {
			const epCompoundId = epCompoundIdFor(epId);
			this.apiKeyCache.set(epCompoundId, apiKey);
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
			const singleCompoundId = apiKey
				? `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}${COMPOUND_ID_SEPARATOR}${apiKey}`
				: `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;
			const video = await this.fetchVideoInfo(singleCompoundId);
			return [video];
		}
	}

	private parseCompoundId(id: string): { serverOrigin: string; itemId: string; apiKey: string } {
		// serverOrigin contains "://" but never "::", so a plain split is safe.
		const parts = id.split(COMPOUND_ID_SEPARATOR);
		if (parts.length < 2) {
			throw new Error(`Invalid Jellyfin compound ID: ${id}`);
		}
		const serverOrigin = parts[0];
		const itemId = parts[1];
		const apiKey = parts[2] ?? this.apiKeyCache.get(id) ?? "";
		return { serverOrigin, itemId, apiKey };
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
		serverOrigin: string,
		mediaSourceId: string,
		apiKey: string,
		audioStreamIndex?: number,
	): string {
		const params = new URLSearchParams();
		if (apiKey) {
			params.set("api_key", apiKey);
		}
		params.set("MediaSourceId", mediaSourceId);
		params.set("AudioCodec", "aac");
		if (audioStreamIndex !== undefined) {
			params.set("AudioStreamIndex", audioStreamIndex.toString());
		}
		const playSessionId = randomUUID().replace(/-/g, "");
		params.set("PlaySessionId", playSessionId);
		return `${serverOrigin}/Videos/${mediaSourceId}/master.m3u8?${params.toString()}`;
	}

	private constructSubtitleUrl(
		serverOrigin: string,
		itemId: string,
		mediaSourceId: string,
		apiKey: string,
		index: number,
	): string {
		const params = new URLSearchParams();
		if (apiKey) {
			params.set("api_key", apiKey);
		}
		return `${serverOrigin}/Videos/${itemId}/${mediaSourceId}/Subtitles/${index}/0/Stream.vtt?${params.toString()}`;
	}

	private resolveDeliveryUrl(serverOrigin: string, deliveryUrl: string, apiKey: string): string {
		const resolved = this.resolveServerUrl(serverOrigin, deliveryUrl);
		return this.withApiKey(resolved, apiKey);
	}

	private isDeliverableSubtitle(stream: JellyfinMediaStream): boolean {
		if (!stream.IsTextSubtitleStream || !stream.SupportsExternalStream) {
			return false;
		}
		if (!stream.Codec) {
			return true;
		}
		return CONVERTIBLE_SUBTITLE_CODECS.includes(stream.Codec.toLowerCase());
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
