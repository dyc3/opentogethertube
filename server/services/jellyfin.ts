import axios from "axios";
import type { Video, VideoMetadata, VideoService, VideoSubtitle } from "ott-common/models/video.js";
import { URL } from "node:url";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import { ServiceAdapter, type VideoRequest } from "../serviceadapter.js";
import { JellyfinApiKeyException, ServiceLinkParseException } from "../exceptions.js";

const log = getLogger("jellyfin");

const JELLYFIN_WEB_URL_REGEX = /\/web(?:\/index\.html)?\/?#!?\/details\?id=/;
const JELLYFIN_ITEMS_URL_REGEX = /\/Items\/[^/]+\/Download/;
const JELLYFIN_HLS_URL_REGEX = /\/Videos\/[^/]+\/(?:master|main)\.m3u8/;
const JELLYFIN_ID_PARAM_REGEX = /[?&]id=([^&#]+)/;
const COMPOUND_ID_SEPARATOR = "::";

interface JellyfinMediaStream {
	Type: string;
	Index: number;
	Codec?: string;
	Language?: string;
	Title?: string;
	DisplayTitle?: string;
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

			const serverOrigin = parsed.origin;
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
			playbackData = await this.fetchPlaybackInfo(serverOrigin, itemId, apiKey);
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
			streamUrl = this.withApiKey(this.resolveServerUrl(serverOrigin, transcodingUrl), apiKey);
		} else {
			streamUrl = this.constructStreamUrl(serverOrigin, mediaSourceId, apiKey);
		}

		let subtitleUrl: string | undefined;
		let availableSubtitles: VideoSubtitle[] | undefined;
		if (mediaSource) {
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
		};
	}

	private async fetchPlaybackInfo(
		serverOrigin: string,
		itemId: string,
		apiKey: string,
	): Promise<JellyfinPlaybackInfo> {
		const resp = await this.api.post(
			`${serverOrigin}/Items/${itemId}/PlaybackInfo`,
			{
				StartTimeTicks: 0,
				IsPlayback: true,
				AutoOpenLiveStream: true,
				AlwaysBurnInSubtitleWhenTranscoding: false,
			},
			{
				headers: this.buildAuthHeaders(apiKey),
			},
		);
		return resp.data as JellyfinPlaybackInfo;
	}

	private resolveServerUrl(serverOrigin: string, url: string): string {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			return url;
		}
		return `${serverOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
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
					log.warn(`fetchManyVideoInfo: failed to fetch jellyfin:${req.id}: ${e}, skipping`);
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
	): string {
		const params = new URLSearchParams();
		if (apiKey) {
			params.set("api_key", apiKey);
		}
		params.set("AudioCodec", "aac");
		return `${serverOrigin}/Videos/${mediaSourceId}/main.m3u8?${params.toString()}`;
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
		const url = new URL(deliveryUrl, serverOrigin);
		if (apiKey && !url.searchParams.has("api_key")) {
			url.searchParams.set("api_key", apiKey);
		}
		return url.toString();
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
			return `${item.SeriesName} - S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`;
		}
		return item.Name;
	}
}
