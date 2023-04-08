import URL from "url";
import _ from "lodash";
import DailyMotionAdapter from "./services/dailymotion";
import GoogleDriveAdapter from "./services/googledrive";
import VimeoAdapter from "./services/vimeo";
import YouTubeAdapter from "./services/youtube";
import DirectVideoAdapter from "./services/direct";
import RedditAdapter from "./services/reddit";
import storage from "./storage";
import {
	UnsupportedMimeTypeException,
	OutOfQuotaException,
	UnsupportedServiceException,
	InvalidAddPreviewInputException,
	FeatureDisabledException,
} from "./exceptions";
import { getLogger } from "./logger";
import { redisClient, redisClientAsync } from "./redisclient";
import { isSupportedMimeType } from "./mime";
import { Video, VideoId, VideoMetadata } from "../common/models/video";
import { ServiceAdapter } from "./serviceadapter";
import { OttException } from "../common/exceptions";
import TubiAdapter from "./services/tubi";
import { Counter } from "prom-client";
import { conf } from "./ott-config";

const log = getLogger("infoextract");

const adapters = [
	new DailyMotionAdapter(),
	new GoogleDriveAdapter(conf.get("info_extractor.google_drive.api_key") as unknown as string),
	new VimeoAdapter(),
	new YouTubeAdapter(
		conf.get("info_extractor.youtube.api_key") as unknown as string,
		redisClient,
		redisClientAsync
	),
	new DirectVideoAdapter(),
	new RedditAdapter(),
	new TubiAdapter(),
];

const ADD_PREVIEW_SEARCH_MIN_LENGTH = conf.get("add_preview.search.min_query_length");
const ENABLE_SEARCH = conf.get("add_preview.search.enabled");

function mergeVideo(a: Video, b: Video): Video {
	return Object.assign(
		a,
		_.pickBy(b, x => !!x)
	);
}

export default {
	isURL(str: string): boolean {
		return URL.parse(str).host !== null;
	},

	/**
	 * Returns a cached video and an array with property names. The property names indicate which
	 * properties are still missing from the cache. On a cache miss, this function will return an empty
	 * video object.
	 */
	async getCachedVideo(
		service: string,
		videoId: string
	): Promise<[Video, (keyof VideoMetadata)[]]> {
		try {
			const result = await storage.getVideoInfo(service, videoId);
			const video = result;
			const missingInfo = storage.getVideoInfoFields(video.service).filter(p => !video[p]);

			if (video.mime && !isSupportedMimeType(video.mime)) {
				throw new UnsupportedMimeTypeException(video.mime);
			}

			return [video, missingInfo];
		} catch (e) {
			if (e instanceof Error) {
				log.error(`Failed to get video metadata: ${e.message} ${e.stack}`);
			} else {
				log.error(`Failed to get video metadata`);
			}
			throw e;
		}
	},

	/**
	 * Writes video info objects to the database.
	 */
	async updateCache(videos: Video[] | Video): Promise<void> {
		if (Array.isArray(videos)) {
			return storage.updateManyVideoInfo(videos);
		} else {
			return storage.updateVideoInfo(videos);
		}
	},

	async getCachedSearchResults(service: string, query: string): Promise<Video[]> {
		const value = await redisClientAsync.get(`search:${service}:${query}`);
		return JSON.parse(value);
	},

	async cacheSearchResults(service: string, query: string, results: Video[]): Promise<void> {
		await redisClientAsync.set(
			`search:${service}:${query}`,
			JSON.stringify(results),
			"EX",
			60 * 60 * 24
		);
	},

	/**
	 * Returns the adapter instance for a given service name.
	 */
	getServiceAdapter(service: string): ServiceAdapter {
		const adapter = adapters.find(adapter => adapter.serviceId === service);
		if (!adapter) {
			throw new OttException(`Unkonwn service: ${service}`);
		}
		return adapter;
	},

	/**
	 * Returns the adapter that can handle a given URL.
	 */
	getServiceAdapterForURL(url: string): ServiceAdapter {
		const adapter = adapters.find(adapter => adapter.canHandleURL(url));
		if (!adapter) {
			throw new UnsupportedServiceException(url);
		}
		return adapter;
	},

	/**
	 * Returns metadata for a single video. Uses cached info if possible and writes newly fetched info
	 * to the cache.
	 */
	async getVideoInfo(service: string, videoId: string): Promise<Video> {
		counterMethodsInvoked.labels({ method: "getVideoInfo" }).inc();

		const adapter = this.getServiceAdapter(service);
		const [cachedVideo, missingInfo] = await this.getCachedVideo(service, videoId);

		if (missingInfo.length === 0) {
			return cachedVideo;
		} else {
			log.warn(
				`MISSING INFO for ${cachedVideo.service}:${
					cachedVideo.id
				}: ${missingInfo.toString()}`
			);

			try {
				const fetchedVideo = await adapter.fetchVideoInfo(cachedVideo.id, missingInfo);
				if (fetchedVideo.service === cachedVideo.service) {
					const video = mergeVideo(cachedVideo, fetchedVideo);
					if (adapter.isCacheSafe) {
						this.updateCache(video);
					}
					return video;
				} else {
					log.info("video services don't match, must be an alias");
					const video = fetchedVideo;
					const newadapter = this.getServiceAdapter(video.service);
					if (newadapter.isCacheSafe) {
						this.updateCache(video);
					}
					return video;
				}
			} catch (e) {
				if (e instanceof OutOfQuotaException) {
					log.error("Failed to get video info: Out of quota");
					if (
						missingInfo.length < storage.getVideoInfoFields(cachedVideo.service).length
					) {
						log.warn(
							`Returning incomplete cached result for ${cachedVideo.service}:${cachedVideo.id}`
						);
						return cachedVideo;
					} else {
						throw e;
					}
				} else {
					if (e instanceof Error) {
						log.error(
							`Failed to get video info for ${cachedVideo.service}:${cachedVideo.id}: ${e.message} ${e.stack}`
						);
					} else {
						log.error(
							`Failed to get video info for ${cachedVideo.service}:${cachedVideo.id}`
						);
					}
					throw e;
				}
			}
		}
	},

	async getManyVideoInfo(videoIds: VideoId[]): Promise<Video[]> {
		counterMethodsInvoked.labels({ method: "getManyVideoInfo" }).inc();

		const grouped = _.groupBy(videoIds, "service");
		const results = await Promise.all(
			Object.entries(grouped).map(async ([service, serviceVideos]) => {
				// Handle each service separately
				const cachedVideos: Video[] = await storage.getManyVideoInfo(serviceVideos);
				const requests = cachedVideos
					.map(video => ({
						id: video.id,
						missingInfo: storage
							.getVideoInfoFields(video.service)
							.filter(p => !video[p]),
					}))
					.filter(request => request.missingInfo.length > 0);

				if (requests.length === 0) {
					return cachedVideos;
				}

				const adapter = this.getServiceAdapter(service);
				const fetchedVideos = await adapter.fetchManyVideoInfo(requests);
				const finalResults = cachedVideos.map(video => {
					const fetchedVideo = fetchedVideos.find(v => v.id === video.id);
					if (fetchedVideo) {
						return mergeVideo(video, fetchedVideo);
					} else {
						return video;
					}
				});
				return finalResults;
			})
		);

		const flattened = results.flat();
		// type cast should be safe here because find should always be able to find a video.
		const result = videoIds
			.map(video => flattened.find(v => v.id === video.id) as Video)
			.filter(v => !!v);
		this.updateCache(
			result.filter(video => {
				const adapter = this.getServiceAdapter(video.service);
				return adapter.isCacheSafe;
			})
		);
		return result;
	},

	/**
	 * Turns a search query into a list of videos, regardless of whether it contains a link to a single
	 * video or a video collection, or search terms to run against an API. If query is a URL, a service
	 * adapter will automatically be selected to handle it. If it is not a URL, searchService will be
	 * used to perform a search.
	 */
	async resolveVideoQuery(query: string, searchService: string): Promise<Video[]> {
		counterAddPreviewsRequested.inc();
		counterMethodsInvoked.labels({ method: "resolveVideoQuery" }).inc();
		try {
			let result = await this.resolveVideoQueryImpl(query, searchService);
			counterAddPreviewsCompleted.labels({ result: "success" }).inc();
			return result;
		} catch (e: unknown) {
			if (e instanceof Error) {
				counterAddPreviewsCompleted.labels({ result: "failure", error: e.name }).inc();
			}
			throw e;
		}
	},

	async resolveVideoQueryImpl(query: string, searchService: string): Promise<Video[]> {
		let results: Video[] = [];

		if (query.includes("\n")) {
			const lines = query
				.trim()
				.split("\n")
				.filter(line => this.isURL(line));

			const videoIds = lines.map(line => {
				const adapter = this.getServiceAdapterForURL(line);
				return {
					service: adapter.serviceId,
					id: adapter.getVideoId(line),
				};
			});

			results = await this.getManyVideoInfo(videoIds);
		} else if (this.isURL(query)) {
			const adapter = this.getServiceAdapterForURL(query);

			if (!adapter) {
				throw new UnsupportedServiceException(query);
			}

			if (!adapter.isCollectionURL(query)) {
				return [await this.getVideoInfo(adapter.serviceId, adapter.getVideoId(query))];
			}

			const fetchResults = await adapter.resolveURL(query);
			const resolvedResults: VideoId[] = [];
			for (let video of fetchResults) {
				if ("url" in video) {
					try {
						const adapter = this.getServiceAdapterForURL(video.url);
						if (!adapter) {
							continue;
						}
						if (adapter.isCollectionURL(video.url)) {
							continue;
						}
						resolvedResults.push({
							service: adapter.serviceId,
							id: adapter.getVideoId(video.url),
						});
					} catch (e) {
						log.warn(`Failed to resolve video URL ${video.url}: ${e.message}`);
						continue;
					}
				} else {
					resolvedResults.push(video);
				}
			}
			const completeResults = await this.getManyVideoInfo(resolvedResults);
			results.push(...completeResults);
		} else {
			if (query.length < ADD_PREVIEW_SEARCH_MIN_LENGTH) {
				throw new InvalidAddPreviewInputException(ADD_PREVIEW_SEARCH_MIN_LENGTH);
			}

			const searchResults = await this.searchVideos(searchService, query);
			results.push(...searchResults);
		}

		this.updateCache(
			results.filter(video => {
				const adapter = this.getServiceAdapter(video.service);
				return adapter.isCacheSafe;
			})
		);
		return results;
	},

	/**
	 * Performs a search on a given video service.
	 */
	async searchVideos(service: string, query: string): Promise<Video[]> {
		if (!ENABLE_SEARCH) {
			throw new FeatureDisabledException("Searching has been disabled by an administrator.");
		}

		const cachedResults = await this.getCachedSearchResults(service, query);
		if (cachedResults) {
			log.info("Using cached results for search");
			const completeResults = await this.getManyVideoInfo(cachedResults);
			counterMediaSearches.labels({ cached: "cached" }).inc();
			return completeResults;
		}

		const adapter = this.getServiceAdapter(service);
		const searchResults = await adapter.searchVideos(query);
		const completeResults = await this.getManyVideoInfo(searchResults);
		this.cacheSearchResults(service, query, searchResults);
		counterMediaSearches.labels({ cached: "uncached" }).inc();
		return completeResults;
	},
};

const counterAddPreviewsRequested = new Counter({
	name: "ott_infoextractor_add_previews_requested",
	help: "The number of add previews that have been requested",
});

const counterAddPreviewsCompleted = new Counter({
	name: "ott_infoextractor_add_previews_completed_total",
	help: "The number of add previews that have been completed",
	labelNames: ["result", "error"],
});

const counterMethodsInvoked = new Counter({
	name: "ott_infoextractor_methods_invoked_total",
	help: "The number of times different info extractor methods were called.",
	labelNames: ["method"],
});

const counterMediaSearches = new Counter({
	name: "ott_infoextractor_search",
	help: "The number of media searches that the info extractor has performed.",
	labelNames: ["cached"],
});
