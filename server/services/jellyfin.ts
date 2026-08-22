import axios from "axios";
import type { Video, VideoMetadata, VideoService, VideoSubtitle } from "ott-common/models/video.js";
import { URL } from "node:url";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import { ServiceAdapter } from "../serviceadapter.js";
import { ServiceLinkParseException } from "../exceptions.js";

const log = getLogger("jellyfin");

const JELLYFIN_WEB_URL_REGEX = /\/web(?:\/index\.html)?\/?#!?\/details\?id=/;
const JELLYFIN_ITEMS_URL_REGEX = /\/Items\/[^/]+\/Download/;
const JELLYFIN_HLS_URL_REGEX = /\/Videos\/[^/]+\/(?:master|main)\.m3u8/;
const JELLYFIN_ID_PARAM_REGEX = /[?&]id=([^&#]+)/;
const COMPOUND_ID_SEPARATOR = "::";

interface JellyfinMediaStream {
	Type: string;
	Index: number;
	Language?: string;
	Title?: string;
	DisplayTitle?: string;
}

interface JellyfinMediaSource {
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
			const compoundId = `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;
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

		const userId = await this.getUserId(serverOrigin, apiKey);

		const itemResp = await this.api.get(`${serverOrigin}/Users/${userId}/Items/${itemId}`, {
			headers: this.buildAuthHeaders(apiKey),
		});
		const item = itemResp.data as JellyfinItem;

		const streamUrl = this.constructStreamUrl(serverOrigin, itemId, apiKey);

		let subtitleUrl: string | undefined;
		let availableSubtitles: VideoSubtitle[] | undefined;

		try {
			const playbackResp = await this.api.get(
				`${serverOrigin}/Items/${itemId}/PlaybackInfo`,
				{
					headers: this.buildAuthHeaders(apiKey),
				},
			);
			const playbackData = playbackResp.data as JellyfinPlaybackInfo;
			const subtitleStreams =
				playbackData.MediaSources?.[0]?.MediaStreams?.filter(s => s.Type === "Subtitle") ??
				[];

			if (subtitleStreams.length > 0) {
				availableSubtitles = subtitleStreams.map(stream => {
					const subtitleUrl = this.constructSubtitleUrl(
						serverOrigin,
						itemId,
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
		} catch (e) {
			log.warn(`Failed to fetch playback info for ${itemId}: ${e}`);
		}

		const title = this.constructTitle(item);
		const length = item.RunTimeTicks ? Math.round(item.RunTimeTicks / 10_000_000) : 0;
		const thumbnail = item.Images?.Primary
			? `${serverOrigin}/Items/${itemId}/Images/Primary?api_key=${apiKey}`
			: "";

		const compoundId = `${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`;

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

	async resolveURL(url: string): Promise<Video[]> {
		const compoundId = this.getVideoId(url);
		const { serverOrigin, itemId, apiKey } = this.parseCompoundId(compoundId);

		const userId = await this.getUserId(serverOrigin, apiKey);

		const itemResp = await this.api.get(`${serverOrigin}/Users/${userId}/Items/${itemId}`, {
			headers: this.buildAuthHeaders(apiKey),
		});
		const item = itemResp.data as JellyfinItem;

		const fetchEpisode = async (epId: string): Promise<Video | null> => {
			const epCompoundId = `${serverOrigin}${COMPOUND_ID_SEPARATOR}${epId}`;
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
			const video = await this.fetchVideoInfo(
				`${serverOrigin}${COMPOUND_ID_SEPARATOR}${itemId}`,
			);
			return [video];
		}
	}

	private parseCompoundId(id: string): { serverOrigin: string; itemId: string; apiKey: string } {
		const separatorIndex = id.indexOf(COMPOUND_ID_SEPARATOR);
		if (separatorIndex === -1) {
			throw new Error(`Invalid Jellyfin compound ID: ${id}`);
		}
		const serverOrigin = id.substring(0, separatorIndex);
		const itemId = id.substring(separatorIndex + COMPOUND_ID_SEPARATOR.length);
		const apiKey = this.apiKeyCache.get(id) ?? "";
		return { serverOrigin, itemId, apiKey };
	}

	private constructStreamUrl(serverOrigin: string, itemId: string, apiKey: string): string {
		const params = new URLSearchParams();
		params.set("mediaSourceId", itemId);
		if (apiKey) {
			params.set("api_key", apiKey);
		}
		return `${serverOrigin}/Videos/${itemId}/master.m3u8?${params.toString()}`;
	}

	private constructSubtitleUrl(
		serverOrigin: string,
		itemId: string,
		apiKey: string,
		index: number,
	): string {
		const params = new URLSearchParams();
		if (apiKey) {
			params.set("api_key", apiKey);
		}
		return `${serverOrigin}/Videos/${itemId}/${itemId}/Subtitles/${index}/0/Stream.vtt?${params.toString()}`;
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
