import URL from "url";
import _ from "lodash";
import DailyMotionAdapter from "./services/dailymotion";
import GoogleDriveAdapter from "./services/googledrive";
import VimeoAdapter from "./services/vimeo";
import YouTubeAdapter from "./services/youtube";
import DirectVideoAdapter from "./services/direct";
import RedditAdapter from "./services/reddit";
import NeverthinkAdapter from "./services/neverthink";
import storage from "../storage";
import Video from "../common/video";
import { UnsupportedMimeTypeException, OutOfQuotaException, UnsupportedServiceException, InvalidAddPreviewInputException, FeatureDisabledException } from "./exceptions";
import { getLogger } from "../logger";
import { redisClient } from "../redisclient";
import { isSupportedMimeType } from "./mime";

const log = getLogger("infoextract");

const adapters = [
  new DailyMotionAdapter(),
  new GoogleDriveAdapter(process.env.GOOGLE_DRIVE_API_KEY),
  new VimeoAdapter(),
  new YouTubeAdapter(process.env.YOUTUBE_API_KEY, redisClient),
  new DirectVideoAdapter(),
  new RedditAdapter(),
  new NeverthinkAdapter(),
];

const ADD_PREVIEW_SEARCH_MIN_LENGTH = parseInt(process.env.ADD_PREVIEW_SEARCH_MIN_LENGTH) || 3;
const ENABLE_SEARCH = process.env.ENABLE_SEARCH === undefined || process.env.ENABLE_SEARCH === true || process.env.ENABLE_SEARCH === "true";

export default {
  isURL(str) {
    return URL.parse(str).host !== null;
  },

  /**
   * Returns a cached video and an array with property names. The property names indicate which
   * properties are still missing from the cache. On a cache miss, this function will return an empty
   * video object.
   * @param {string} service
   * @param {string} videoId
   * @returns {[string, string[]]}
   */
  async getCachedVideo(service, videoId) {
    try {
      const result = await storage.getVideoInfo(service, videoId);
      const video = new Video(result);
      const missingInfo = storage
        .getVideoInfoFields(video.service)
        .filter(p => !video[p]);

      if (video.mime && !isSupportedMimeType(video.mime)) {
        throw new UnsupportedMimeTypeException(video.mime);
      }

      return [video, missingInfo];
    }
    catch (e) {
      log.error(`Failed to get video metadata: ${e}`);
      throw e;
    }
  },

  /**
   * Writes video info objects to the database.
   * @param {Video} videos
   * @returns {Promise}
   */
  async updateCache(videos) {
    if (Array.isArray(videos)) {
      return storage.updateManyVideoInfo(videos);
    }
    else {
      return storage.updateVideoInfo(videos);
    }
  },

  getCachedSearchResults(service, query) {
    return new Promise((resolve, reject) => {
      redisClient.get(`search:${service}:${query}`, (err, value) => {
        if (err) {
          reject(err);
          return;
        }
        if (!value) {
          resolve(null);
          return;
        }

        resolve(JSON.parse(value));
      });
    });
  },

  cacheSearchResults(service, query, results) {
    redisClient.set(`search:${service}:${query}`, JSON.stringify(results), "EX", 60 * 60 * 24, (err) => {
      if (err) {
        log.error(`Failed to cache search results: ${err}`);
      }
    });
  },

  /**
   * Returns the adapter instance for a given service name.
   * @param {string} service
   * @returns {ServiceAdapter}
   */
  getServiceAdapter(service) {
    return adapters.find(adapter => adapter.serviceId === service);
  },

  /**
   * Returns the adapter that can handle a given URL.
   * @param {string} url
   * @returns {ServiceAdapter}
   */
  getServiceAdapterForURL(url) {
    return adapters.find(adapter => adapter.canHandleURL(url));
  },

  /**
   * Returns metadata for a single video. Uses cached info if possible and writes newly fetched info
   * to the cache.
   * @param {string} service
   * @param {string} videoId
   * @returns {Promise<Video>}
   */
  async getVideoInfo(service, videoId) {
    const adapter = this.getServiceAdapter(service);
    const [cachedVideo, missingInfo] = await this.getCachedVideo(service, videoId);

    if (missingInfo.length === 0) {
      return cachedVideo;
    }
    else {
      log.warn(`MISSING INFO for ${cachedVideo.service}:${cachedVideo.id}: ${missingInfo}`);

      try {
        const fetchedVideo = await adapter.fetchVideoInfo(cachedVideo.id, missingInfo);
        if (fetchedVideo.service === cachedVideo.service) {
          const video = Video.merge(cachedVideo, fetchedVideo);
          if (adapter.isCacheSafe) {
            this.updateCache(video);
          }
          return video;
        }
        else {
          log.info("video services don't match, must be an alias");
          const video = fetchedVideo;
          const newadapter = this.getServiceAdapter(video.service);
          if (newadapter.isCacheSafe) {
            this.updateCache(video);
          }
          return video;
        }
      }
      catch (e) {
        if (e instanceof OutOfQuotaException) {
          log.error("Failed to get video info: Out of quota");
          if (missingInfo.length < storage.getVideoInfoFields(cachedVideo.service).length) {
            log.warn(`Returning incomplete cached result for ${cachedVideo.service}:${cachedVideo.id}`);
            return cachedVideo;
          }
          else {
            throw e;
          }
        }
        else {
          log.error(`Failed to get video info for ${cachedVideo.service}:${cachedVideo.id}: ${e}`);
          throw e;
        }
      }
    }
  },

  async getManyVideoInfo(videos) {
    const grouped = _.groupBy(videos, "service");
    const results = await Promise.all(Object.entries(grouped).map(async ([service, serviceVideos]) => {
      // Handle each service separately
      const cachedVideos = await storage.getManyVideoInfo(serviceVideos);
      const requests = cachedVideos
        .map(video => ({
          id: video.id,
          missingInfo: storage.getVideoInfoFields(video.service).filter(p => !video[p]),
        }))
        .filter(request => request.missingInfo.length > 0);

      if (requests.length === 0) {
        return cachedVideos;
      }

      const adapter = this.getServiceAdapter(service);
      const fetchedVideos = await adapter.fetchManyVideoInfo(requests);
      return cachedVideos.map(video => {
        const fetchedVideo = fetchedVideos.find(v => v.id === video.id);
        if (fetchedVideo) {
          return Video.merge(video, fetchedVideo);
        }
        else {
          return video;
        }
      });
    }));

    const flattened = results.flat();
    const result = videos.map(video => flattened.find(v => v.id === video.id));
    this.updateCache(result.filter(video => {
      const adapter = this.getServiceAdapter(video.service);
      return adapter.isCacheSafe;
    }));
    return result;
  },

  /**
   * Turns a search query into a list of videos, regardless of whether it contains a link to a single
   * video or a video collection, or search terms to run against an API. If query is a URL, a service
   * adapter will automatically be selected to handle it. If it is not a URL, searchService will be
   * used to perform a search.
   * @param {string} query
   * @param {string} searchService
   * @returns {Promise<Video[]>}
   */
  async resolveVideoQuery(query, searchService) {
    const results = [];

    if (this.isURL(query)) {
      const adapter = this.getServiceAdapterForURL(query);

      if (!adapter) {
        const url = URL.parse(query);
        throw new UnsupportedServiceException(url);
      }

      if (!adapter.isCollectionURL(query)) {
        return [
          await this.getVideoInfo(
            adapter.serviceId,
            adapter.getVideoId(query)
          ),
        ];
      }

      const fetchResults = await adapter.resolveURL(query);
      let resolvedResults = fetchResults.map(video => {
        if ((!video.service || !video.id) && video.url) {
          const adapter = this.getServiceAdapterForURL(video.url);
          if (!adapter) {
            return null;
          }
          return new Video({
            service: adapter.serviceId,
            id: adapter.getVideoId(video.url),
          });
        }
        return video;
      }).filter(video => !!video);
      const completeResults = await this.getManyVideoInfo(resolvedResults);
      results.push(...completeResults);
    }
    else {
      if (query.length < ADD_PREVIEW_SEARCH_MIN_LENGTH) {
        throw new InvalidAddPreviewInputException(ADD_PREVIEW_SEARCH_MIN_LENGTH);
      }

      const searchResults = await this.searchVideos(searchService, query);
      results.push(...searchResults);
    }

    this.updateCache(results);
    return results;
  },

  /**
   * Performs a search on a given video service.
   * @param {string} service
   * @param {string} query
   * @returns {Video[]}
   */
  async searchVideos(service, query) {
    if (!ENABLE_SEARCH) {
      throw new FeatureDisabledException("Searching has been disabled by an administrator.");
    }

    const cachedResults = await this.getCachedSearchResults(service, query);
    if (cachedResults) {
      log.info("Using cached results for search");
      const completeResults = await this.getManyVideoInfo(cachedResults);
      return completeResults;
    }

    const adapter = this.getServiceAdapter(service);
    const searchResults = await adapter.searchVideos(query);
    const completeResults = await this.getManyVideoInfo(searchResults);
    this.cacheSearchResults(service, query, searchResults);
    return completeResults;
  },
};
