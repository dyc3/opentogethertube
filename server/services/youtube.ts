import { URL } from "url";
import axios, { AxiosResponse } from "axios";
import _ from "lodash";
import { RedisClientType } from "redis";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import {
	BadApiArgumentException,
	InvalidVideoIdException,
	OutOfQuotaException,
	UnsupportedVideoType,
	VideoNotFoundException,
} from "../exceptions";
import { getLogger } from "../logger";
import { Video, VideoId, VideoMetadata } from "../../common/models/video";
import storage from "../storage";
import { OttException } from "../../common/exceptions";
import { conf } from "../ott-config";

const log = getLogger("youtube");

const knownPrivateLists = ["LL", "WL"];

const ADD_PREVIEW_PLAYLIST_RESULTS_COUNT = conf.get("add_preview.playlist_results_count");
const ADD_PREVIEW_SEARCH_RESULTS_COUNT = conf.get("add_preview.search.results_count");

interface YoutubeChannelData {
	channel?: string;
	user?: string;
	customUrl?: string;
	handle?: string;
}

export interface YoutubeApiVideoListResponse {
	kind: "youtube#videoListResponse";
	etag: string;
	nextPageToken: string;
	prevPageToken: string;
	pageInfo: YoutubeApiPageInfo;
	items: YoutubeApiVideo[];
}

interface YoutubeApiPageInfo {
	totalResults: number;
	resultsPerPage: number;
}

export interface YoutubeApiVideo {
	kind: "youtube#video";
	etag: string;
	id: string;
	snippet?: {
		publishedAt: string;
		channelId: string;
		title: string;
		description: string;
		thumbnails: {
			medium: YoutubeThumbnailInfo;
			default: YoutubeThumbnailInfo;
		};
		channelTitle: string;
		tags: string[];
		categoryId: string;
		liveBroadcastContent: string;
		defaultLanguage: string;
		localized: {
			title: string;
			description: string;
		};
		defaultAudioLanguage: string;
	};
	contentDetails?: {
		duration: string;
		dimension: string;
		definition: string;
		caption: string;
		licensedContent: boolean;
		regionRestriction: {
			allowed?: string[] | null;
			blocked?: string[] | null;
		};
		projection: string;
		hasCustomThumbnail: boolean;
	};
	status?: {
		uploadStatus: string;
		failureReason: string;
		rejectionReason: string;
		privacyStatus: string;
		publishAt: string;
		license: string;
		embeddable: boolean;
		publicStatsViewable: boolean;
		madeForKids: boolean;
		selfDeclaredMadeForKids: boolean;
	};
	statistics?: {
		viewCount: number;
		likeCount: number;
		dislikeCount: number;
		favoriteCount: number;
		commentCount: number;
	};
}

interface YoutubeThumbnailInfo {
	url: string;
	width: number;
	height: number;
}

export interface YoutubeErrorResponse {
	error: {
		code: number;
		message: string;
		status: string;
		errors: {
			message: string;
			domain: string;
			reason: string;
		}[];
	};
}

export type YoutubeApiPart = "id" | "snippet" | "contentDetails" | "status" | "statistics";

function isYoutubeApiError(
	response: AxiosResponse<any>
): response is AxiosResponse<YoutubeErrorResponse> {
	return "error" in response.data;
}

export default class YouTubeAdapter extends ServiceAdapter {
	apiKey: string;
	redisClient: RedisClientType;
	api = axios.create({
		baseURL: "https://www.googleapis.com/youtube/v3",
	});
	fallbackApi = axios.create();

	constructor(apiKey: string, redisClient: RedisClientType) {
		super();

		this.apiKey = apiKey;
		this.redisClient = redisClient;
	}

	get serviceId(): "youtube" {
		return "youtube";
	}

	get isCacheSafe(): boolean {
		return true;
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);

		if (url.host.endsWith("youtube.com")) {
			return (
				(url.pathname.startsWith("/watch") && !!url.searchParams.get("v")) ||
				(url.pathname.startsWith("/channel/") && url.pathname.length > 9) ||
				(url.pathname.startsWith("/user/") && url.pathname.length > 6) ||
				(url.pathname.startsWith("/c/") && url.pathname.length > 3) ||
				(url.pathname.startsWith("/playlist") && !!url.searchParams.get("list")) ||
				url.pathname.startsWith("/shorts/") ||
				url.pathname.startsWith("/live/") ||
				(url.pathname.startsWith("/@") && url.pathname.length > 2) ||
				(url.host === "studio.youtube.com" && url.pathname.startsWith("/video/"))
			);
		} else if (url.host.endsWith("youtu.be")) {
			return url.pathname.length > 1;
		} else {
			return false;
		}
	}

	isCollectionURL(link: string): boolean {
		const url = new URL(link);
		let qList = url.searchParams.get("list");
		return (
			url.pathname.startsWith("/channel/") ||
			url.pathname.startsWith("/c/") ||
			url.pathname.startsWith("/user/") ||
			url.pathname.startsWith("/playlist") ||
			url.pathname.startsWith("/@") ||
			(!!qList && !knownPrivateLists.includes(qList))
		);
	}

	getVideoId(link: string): string {
		const url = new URL(link);
		if (url.host.endsWith("youtu.be")) {
			return url.pathname.replace("/", "").trim();
		} else if (url.pathname.startsWith("/watch")) {
			let videoId = url.searchParams.get("v");
			if (!videoId) {
				throw new BadApiArgumentException("input", "No video ID found in URL");
			}
			return videoId.trim();
		} else {
			return url.pathname.split("/")[2];
		}
	}

	async resolveURL(link: string, onlyProperties?: (keyof VideoMetadata)[]): Promise<Video[]> {
		log.debug(`resolveURL: ${link}, ${onlyProperties ? onlyProperties.toString() : ""}`);
		const url = new URL(link);

		const qPlaylist = url.searchParams.get("list");

		if (
			url.pathname.startsWith("/c/") ||
			url.pathname.startsWith("/channel/") ||
			url.pathname.startsWith("/user/") ||
			url.pathname.startsWith("/@")
		) {
			return this.fetchChannelVideos(this.getChannelId(url));
		} else if (url.pathname === "/playlist") {
			if (qPlaylist) {
				return this.fetchPlaylistVideos(qPlaylist);
			} else {
				throw new BadApiArgumentException("input", "Link is missing playlist ID");
			}
		} else {
			if (qPlaylist && !knownPrivateLists.includes(qPlaylist)) {
				try {
					return await this.fetchVideoWithPlaylist(this.getVideoId(link), qPlaylist);
				} catch {
					log.debug("Falling back to fetching video without playlist");
					return [await this.fetchVideoInfo(this.getVideoId(link), onlyProperties)];
				}
			} else {
				return [await this.fetchVideoInfo(this.getVideoId(link), onlyProperties)];
			}
		}
	}

	async fetchVideoInfo(id: string, onlyProperties?: (keyof VideoMetadata)[]): Promise<Video> {
		let result = await this.videoApiRequest([id], onlyProperties);
		if (result.length === 0) {
			throw new VideoNotFoundException();
		}
		// @ts-expect-error this was fine before
		return result[0];
	}

	async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
		const groupedByMissingInfo = _.groupBy(requests, request => request.missingInfo);
		let results: Video[] = [];
		for (let group of Object.values(groupedByMissingInfo)) {
			const ids = group.map(request => request.id);
			try {
				let result = await this.videoApiRequest(ids, group[0].missingInfo);
				// @ts-expect-error this was fine before
				results.push(...result);
			} catch (e) {
				if (e instanceof UnsupportedVideoType) {
					log.debug("Unsupported video type found, skipping");
				} else {
					throw e;
				}
			}
		}
		return results;
	}

	async fetchChannelVideos(channelData: YoutubeChannelData): Promise<Video[]> {
		const cachedPlaylistId = await this.getCachedPlaylistId(channelData);
		if (cachedPlaylistId) {
			log.info("Using cached uploads playlist id");
			return this.fetchPlaylistVideos(cachedPlaylistId);
		}

		if (channelData.customUrl || channelData.handle) {
			// HACK: The youtube API doesn't allow us to grab the youtube channel id only from the channel's URL. See #285
			channelData.channel = await this.getChannelIdFromYoutubeCustomOrHandleUrl(channelData);
		}

		const channelIdKey = channelData.channel ? "channel" : "user";
		const channelIdProp = channelData.customUrl || channelData.channel ? "id" : "forUsername";
		const channelIdValue = channelData[channelIdKey];
		try {
			const res = await this.api.get("/channels", {
				params: {
					key: this.apiKey,
					part: "contentDetails",
					[channelIdProp]: channelIdValue,
				},
			});

			const uploadsPlaylistId = res.data.items[0].contentDetails.relatedPlaylists.uploads;
			this.cachePlaylistId(
				{
					...channelData,
					channel: res.data.items[0].id,
				},
				uploadsPlaylistId
			);

			return this.fetchPlaylistVideos(uploadsPlaylistId);
		} catch (err) {
			if (axios.isAxiosError(err) && err.response && err.response.status === 403) {
				log.error("Error when getting channel upload playlist ID: Out of quota");
				throw new OutOfQuotaException(this.serviceId);
			} else {
				if (err instanceof Error) {
					log.error(
						`Error when getting channel upload playlist ID: ${err.message} ${err.stack}`
					);
				}
				throw err;
			}
		}
	}

	async getCachedPlaylistId(channelData: YoutubeChannelData): Promise<string | null> {
		const possibleKeys: Array<keyof YoutubeChannelData> = [
			"customUrl",
			"channel",
			"user",
			"handle",
		];
		let idKey: keyof YoutubeChannelData | undefined;
		for (let key of possibleKeys) {
			if (Object.prototype.hasOwnProperty.call(channelData, key)) {
				idKey = key;
				break;
			}
		}
		if (idKey === undefined) {
			log.debug(`channel data invalid`);
			return null;
		}

		const idValue = channelData[idKey];
		const redisKey = `ytchannel:${idKey}:${idValue}`;
		log.debug(`grabbing channel playlist id from cache: ${redisKey}`);

		let result = await this.redisClient.get(redisKey);
		log.debug(`got channel playlist id from cache: ${result}`);

		return result;
	}

	async cachePlaylistId(channelData: YoutubeChannelData, playlistId: string): Promise<void> {
		const possibleKeys: Array<keyof YoutubeChannelData> = [
			"customUrl",
			"channel",
			"user",
			"handle",
		];
		for (let key of possibleKeys) {
			if (Object.prototype.hasOwnProperty.call(channelData, key)) {
				const idValue = channelData[key];
				const redisKey = `ytchannel:${key}:${idValue}`;
				log.info(`caching channel playlist id: ${redisKey}`);
				await this.redisClient.set(redisKey, playlistId);
			}
		}
	}

	async fetchPlaylistVideos(playlistId: string): Promise<Video[]> {
		try {
			const res = await this.api.get("/playlistItems", {
				params: {
					key: this.apiKey,
					part: "snippet,status",
					playlistId: playlistId,
					maxResults: ADD_PREVIEW_PLAYLIST_RESULTS_COUNT,
				},
			});

			const results: Video[] = [];
			for (const item of res.data.items) {
				if (
					item.status.privacyStatus === "private" || // the video is private
					item.status.privacyStatus === "privacyStatusUnspecified" // the video has been deleted?
				) {
					continue;
				}
				const video: Video = {
					service: this.serviceId,
					id: item.snippet.resourceId.videoId,
					title: item.snippet.title,
					description: item.snippet.description,
				};
				if (item.snippet.thumbnails) {
					if (item.snippet.thumbnails.medium) {
						video.thumbnail = item.snippet.thumbnails.medium.url;
					} else {
						video.thumbnail = item.snippet.thumbnails.default.url;
					}
				}
				results.push(video);
			}

			return results;
		} catch (err) {
			if (
				axios.isAxiosError(err) &&
				err.response &&
				isYoutubeApiError(err.response) &&
				err.response.status === 403
			) {
				throw new OutOfQuotaException(this.serviceId);
			} else {
				throw err;
			}
		}
	}

	async fetchVideoWithPlaylist(videoId: string, playlistId: string): Promise<Video[]> {
		const playlist = await this.fetchPlaylistVideos(playlistId);
		let highlighted = false;
		playlist.forEach(video => {
			if (video.id === videoId) {
				highlighted = true;
				video.highlight = true;
			}
		});

		if (!highlighted) {
			const video = await this.fetchVideoInfo(videoId);
			video.highlight = true;
			playlist.unshift(video);
		}

		return playlist;
	}

	async videoApiRequest(
		ids: string | string[],
		onlyProperties?: (keyof VideoMetadata)[]
	): Promise<Partial<Video>[]> {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}

		for (const id of ids) {
			if (!/^[A-za-z0-9_-]+$/.exec(id)) {
				throw new InvalidVideoIdException(this.serviceId, id);
			}
		}

		const parts = this.getNeededParts(onlyProperties);
		log.silly(`Requesting ${parts.length} parts for ${ids.length} videos`);
		try {
			const res: AxiosResponse<YoutubeApiVideoListResponse> = await this.api.get("/videos", {
				params: {
					key: this.apiKey,
					part: parts.join(","),
					id: ids.join(","),
				},
			});
			const results: Video[] = [];
			let foundLivestream = false;
			for (const item of res.data.items) {
				if (item.snippet && item.snippet.liveBroadcastContent !== "none") {
					log.debug(
						`found liveBroadcastContent=${item.snippet.liveBroadcastContent}, skipping`
					);
					foundLivestream = true;
					continue;
				}
				results.push(this.parseVideoItem(item));
			}
			if (results.length === 0 && foundLivestream) {
				throw new UnsupportedVideoType("livestream");
			}
			try {
				await storage.updateManyVideoInfo(results);
			} catch (err) {
				if (err instanceof Error) {
					log.error(
						`Failed to cache video info, will return metadata anyway: ${err.message} ${err.stack}`
					);
				} else {
					log.error(`Failed to cache video info, will return metadata anyway`);
				}
			}
			return results;
		} catch (err) {
			if (axios.isAxiosError(err)) {
				if (err.response && isYoutubeApiError(err.response)) {
					if (err.response.status === 403) {
						if (!onlyProperties || onlyProperties.includes("length")) {
							log.warn(`Attempting youtube fallback method for ${ids.length} videos`);
							try {
								const videos: Partial<Video>[] =
									await this.getManyVideoLengthsFallback(ids);
								return videos;
							} catch (err) {
								if (err instanceof Error) {
									log.error(
										`Youtube fallback failed ${err.message} ${err.stack}`
									);
								} else {
									log.error(`Youtube fallback failed, but threw non Error`);
								}
								throw err;
							}
						} else {
							log.warn("No fallback method for requested metadata properties");
							throw new OutOfQuotaException("youtube");
						}
					} else {
						log.error(
							`videoApiRequest failed: http status ${
								err.response.status
							}, response: ${JSON.stringify(err.response.data)}`
						);
						throw err;
					}
				} else {
					throw err;
				}
			} else {
				throw err;
			}
		}
	}

	private parseVideoItem(item: YoutubeApiVideo) {
		const video: Video = {
			service: this.serviceId,
			id: item.id,
		};
		if (item.snippet) {
			video.title = item.snippet.title;
			video.description = item.snippet.description;
			if (item.snippet.thumbnails) {
				if (item.snippet.thumbnails.medium) {
					video.thumbnail = item.snippet.thumbnails.medium.url;
				} else {
					video.thumbnail = item.snippet.thumbnails.default.url;
				}
			}
		}
		if (item.contentDetails) {
			try {
				video.length = this.parseVideoLength(item.contentDetails.duration);
			} catch (e) {
				log.error(
					`Failed to parse video length for ${item.id}. input: "${
						item.contentDetails.duration
					}" (type ${typeof item.contentDetails.duration})`
				);
				throw e;
			}
		}
		return video;
	}

	private async getManyVideoLengthsFallback(ids: string[]) {
		const getLengthPromises = ids.map(id => this.getVideoLengthFallback(id));
		const results = await Promise.all(getLengthPromises);
		const videos: Video[] = _.zip(ids, results).map(
			([id, length]) =>
				({
					service: "youtube",
					id,
					length,
					// HACK: we can guess what the thumbnail url is, but this could possibly change without warning
					thumbnail: `https://i.ytimg.com/vi/${id}/default.jpg`,
				} as Video)
		);
		try {
			await storage.updateManyVideoInfo(videos);
		} catch (err) {
			if (err instanceof Error) {
				log.error(
					`Failed to cache video info, returning result anyway: ${err.message} ${err.stack}`
				);
			}
		}
		return videos;
	}

	private getNeededParts(onlyProperties?: (keyof VideoMetadata)[]) {
		let parts: YoutubeApiPart[] = [];
		if (onlyProperties) {
			if (
				onlyProperties.includes("title") ||
				onlyProperties.includes("description") ||
				onlyProperties.includes("thumbnail")
			) {
				parts.push("snippet");
			}
			if (onlyProperties.includes("length")) {
				parts.push("contentDetails");
			}

			if (parts.length === 0) {
				log.error(
					`onlyProperties must have valid values or be null! Found ${onlyProperties.toString()}`
				);
				throw new Error("onlyProperties must have valid values or be null!");
			}
		} else {
			parts = ["snippet", "contentDetails"];
		}
		return parts;
	}

	async getVideoLengthFallback(id: string): Promise<number | undefined> {
		const url = `https://youtube.com/watch?v=${id}`;
		const res = await this.fallbackApi.get(url);
		const regexs = [/length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/, /lengthSeconds":"\d+/];
		for (let r = 0; r < regexs.length; r++) {
			const matches = res.data.match(regexs[r]);
			if (matches === null) {
				continue;
			}
			const match: string = matches[0];
			const extracted = match.split(":")[1].substring(r === 1 ? 2 : 1);
			log.silly(`MATCH ${match}`);
			log.debug(`EXTRACTED ${extracted}`);
			return parseInt(extracted, 10);
		}
	}

	getChannelId(url: URL): YoutubeChannelData {
		const match = /\/(?!(?:c(?:hannel)?|user)\/)(@?[a-z0-9_-]+)/gi.exec(url.pathname);
		if (match === null) {
			throw new OttException("Invalid channel url");
		}
		const channelId = match[1];
		if (url.pathname.startsWith("/channel/")) {
			return { channel: channelId };
		} else if (url.pathname.startsWith("/user/")) {
			return { user: channelId };
		} else if (url.pathname.startsWith("/@")) {
			return { handle: channelId };
		} else {
			return { customUrl: channelId };
		}
	}

	async searchVideos(query: string, options?: { maxResults: number }): Promise<Video[]> {
		options = _.defaults(options, {
			maxResults: ADD_PREVIEW_SEARCH_RESULTS_COUNT,
		});

		const params = {
			key: this.apiKey,
			part: "id",
			type: "video",
			maxResults: options.maxResults,
			safeSearch: "none",
			videoEmbeddable: true,
			videoSyndicated: true,
			q: query,
			eventType: "none",
		};

		try {
			const res = await this.api.get("/search", { params });
			const results: VideoId[] = res.data.items.map(searchResult => ({
				service: this.serviceId,
				id: searchResult.id.videoId,
			}));
			return results;
		} catch (err) {
			if (err.response && err.response.status === 403) {
				throw new OutOfQuotaException(this.serviceId);
			} else {
				throw err;
			}
		}
	}

	/**
	 * Hacky workaround for #285. Feature was requested here: https://issuetracker.google.com/issues/165676622
	 */
	async getChannelIdFromYoutubeCustomOrHandleUrl(
		channelData: YoutubeChannelData
	): Promise<string | undefined> {
		let res: AxiosResponse<any, any>;
		if (channelData.handle) {
			log.debug(`web scraping to find channel id for handle: ${channelData.handle}`);
			res = await this.fallbackApi.get(`https://youtube.com/${channelData.handle}`);
		} else if (channelData.customUrl) {
			log.debug(`web scraping to find channel id for custom url: ${channelData.customUrl}`);
			res = await this.fallbackApi.get(`https://youtube.com/c/${channelData.customUrl}`);
		} else {
			return undefined;
		}
		const regex = /externalId":"UC[A-Za-z0-9_-]{22}/;
		const matches = res.data.match(regex);
		if (matches === null) {
			return undefined;
		}
		const extracted = matches[0].split(":")[1].substring(1);
		return extracted;
	}

	/**
	 * Parse youtube's unconventional video duration format into seconds.
	 * Examples: PT40M25S
	 */
	parseVideoLength(duration: string): number {
		let match = /P(\d+D)?(?:T(\d+H)?(\d+M)?(\d+S)?)?/
			.exec(duration)
			?.slice(1)
			.map(x => {
				if (x !== null && x !== undefined) {
					return x.replace(/\D/, "");
				}
			});

		if (match === undefined) {
			throw new Error(`Failed to parse duration: ${duration}`);
		}

		const days = parseInt(match[0] ?? "0", 10) || 0;
		const hours = parseInt(match[1] ?? "0", 10) || 0;
		const minutes = parseInt(match[2] ?? "0", 10) || 0;
		const seconds = parseInt(match[3] ?? "0", 10) || 0;

		return days * (24 * 3600) + hours * 3600 + minutes * 60 + seconds;
	}
}
