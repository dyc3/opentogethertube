import { URL } from "url";
import axios, { AxiosResponse } from "axios";
import _ from "lodash";
import { RedisClient } from "redis";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import { InvalidVideoIdException, OutOfQuotaException, UnsupportedVideoType } from "../exceptions";
import { getLogger } from "../../logger";
import { Video, VideoId, VideoMetadata } from "../../common/models/video";
import storage from "../../storage";

const log = getLogger("youtube");

const knownPrivateLists = ["LL", "WL"];

const ADD_PREVIEW_PLAYLIST_RESULTS_COUNT = parseInt(process.env.ADD_PREVIEW_PLAYLIST_RESULTS_COUNT, 10) || 40;
const ADD_PREVIEW_SEARCH_RESULTS_COUNT = parseInt(process.env.ADD_PREVIEW_SEARCH_RESULTS_COUNT, 10) || 10;

interface YoutubeChannelData {
  channel?: string
  user?: string
  customUrl?: string
}

interface YoutubeApiVideoListResponse {
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

interface YoutubeApiVideo {
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
      allowed?: (string)[] | null;
      blocked?: (string)[] | null;
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

export default class YouTubeAdapter extends ServiceAdapter {
  apiKey: string
  redisClient: RedisClient
  api = axios.create({
    baseURL: "https://www.googleapis.com/youtube/v3",
  });
  fallbackApi = axios.create();

  constructor(apiKey: string, redisClient: RedisClient) {
    super();

    this.apiKey = apiKey;
    this.redisClient = redisClient;
  }

  get serviceId(): "youtube" {
    return "youtube";
  }

  canHandleURL(link: string): boolean {
    const url = new URL(link);

    if (url.host.endsWith("youtube.com")) {
      return (url.pathname.startsWith("/watch") && !!url.searchParams.get("v")) ||
        (url.pathname.startsWith("/channel/") && url.pathname.length > 9) ||
        (url.pathname.startsWith("/user/") && url.pathname.length > 6) ||
        (url.pathname.startsWith("/c/") && url.pathname.length > 3) ||
        (url.pathname.startsWith("/playlist") && !!url.searchParams.get("list")) ||
        url.pathname.startsWith("/shorts/") ||
        (url.host === "studio.youtube.com" && url.pathname.startsWith("/video/"));
    }
    else if (url.host.endsWith("youtu.be")) {
      return url.pathname.length > 1;
    }
    else {
      return false;
    }
  }

  isCollectionURL(link: string): boolean {
    const url = new URL(link);
    return url.pathname.startsWith("/channel/") ||
      url.pathname.startsWith("/c/") ||
      url.pathname.startsWith("/user/") ||
      url.pathname.startsWith("/playlist") ||
      (!!url.searchParams.get("list") && !knownPrivateLists.includes(url.searchParams.get("list")));
  }

  getVideoId(link: string): string {
    const url = new URL(link);
    if (url.host.endsWith("youtu.be")) {
      return url.pathname.replace("/", "").trim();
    }
    else if (url.pathname.startsWith("/watch")) {
      return url.searchParams.get("v").trim();
    }
    else {
      return url.pathname.split("/")[2];
    }
  }

  async resolveURL(link: string, onlyProperties?: (keyof VideoMetadata)[]): Promise<Video[]> {
    log.debug(`resolveURL: ${link}, ${onlyProperties}`);
    const url = new URL(link);

    const qPlaylist = url.searchParams.get("list");

    if (url.pathname.startsWith("/c/") || url.pathname.startsWith("/channel/") || url.pathname.startsWith("/user/")) {
      return this.fetchChannelVideos(this.getChannelId(url));
    }
    else if (url.pathname === "/playlist") {
      return this.fetchPlaylistVideos(qPlaylist);
    }
    else {
      if (qPlaylist && !knownPrivateLists.includes(qPlaylist)) {
        try {
          return await this.fetchVideoWithPlaylist(this.getVideoId(link), qPlaylist);
        }
        catch {
          log.debug("Falling back to fetching video without playlist");
          return [await this.fetchVideoInfo(this.getVideoId(link), onlyProperties)];
        }
      }
      else {
        return [await this.fetchVideoInfo(this.getVideoId(link), onlyProperties)];
      }
    }
  }

  async fetchVideoInfo(id: string, onlyProperties?: (keyof VideoMetadata)[]): Promise<Video> {
    return (await this.videoApiRequest([id], onlyProperties))[0];
  }

  async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
    const groupedByMissingInfo = _.groupBy(requests, request => request.missingInfo);
    const groups = await Promise.all(Object.values(groupedByMissingInfo).map(group => {
      const ids = group.map(request => request.id);
      return this.videoApiRequest(ids, group[0].missingInfo);
    }));
    // const results = Object.values(groups.flat()[0]);
    const results = _.flatten(groups);
    return results;
  }

  async fetchChannelVideos(channelData: YoutubeChannelData): Promise<Video[]> {
    const cachedPlaylistId = await this.getCachedPlaylistId(channelData);
    if (cachedPlaylistId) {
      log.info("Using cached uploads playlist id");
      return this.fetchPlaylistVideos(cachedPlaylistId);
    }

    if (channelData.customUrl) {
      // HACK: The youtube API doesn't allow us to grab the youtube channel id only from the channel's URL. See #285
      channelData.channel = await this.getChannelIdFromYoutubeCustomUrl(channelData.customUrl);
    }

    const channelIdKey = channelData.channel ? "channel" : "user";
    const channelIdProp = (channelData.customUrl || channelData.channel) ? "id" : "forUsername";
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
      this.cachePlaylistId({
          user: channelData.user,
          channel: res.data.items[0].id,
          customUrl: channelData.customUrl,
        },
        uploadsPlaylistId
      );

      return this.fetchPlaylistVideos(uploadsPlaylistId);
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        log.error("Error when getting channel upload playlist ID: Out of quota");
        throw new OutOfQuotaException(this.serviceId);
      }
      else {
        log.error(`Error when getting channel upload playlist ID: ${err}`);
        throw err;
      }
    }
  }

  getCachedPlaylistId(channelData: YoutubeChannelData): Promise<string | null> {
    const idKey = channelData.customUrl ? "customUrl" : (channelData.channel ? "channel" : "user");
    const idValue = channelData[idKey];
    const redisKey = `ytchannel:${idKey}:${idValue}`;

    return new Promise((resolve, reject) => {
      this.redisClient.get(redisKey, (err, value) => {
        if (err) {
          reject(err);
          return;
        }
        if (!value) {
          resolve(null);
          return;
        }
        resolve(value);
      });
    });
  }

  cachePlaylistId(channelData: YoutubeChannelData, playlistId: string): void {
    const idProp: keyof YoutubeChannelData = channelData.customUrl ? "customUrl" : (channelData.channel ? "channel": "user");
    const idValue = channelData[idProp];
    const key = `ytchannel:${idProp}:${idValue}`;
    this.redisClient.set(key, playlistId, (err) => {
      if (err) {
        log.error(`Failed to cache playlist ID: ${err}`);
      }
      else {
        log.info(`Cached playlist ${key}`);
      }
    });
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

      const results = [];
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
          }
          else {
            video.thumbnail = item.snippet.thumbnails.default.url;
          }
        }
        results.push(video);
      }

      return results;
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        throw new OutOfQuotaException(this.serviceId);
      }
      else {
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

  async videoApiRequest(ids: string | string[], onlyProperties?: (keyof VideoMetadata)[]): Promise<Video[]> {
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
      const res: AxiosResponse<YoutubeApiVideoListResponse> = await this.api
        .get("/videos", {
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
          log.debug(`found liveBroadcastContent=${item.snippet.liveBroadcastContent}, skipping`);
          foundLivestream = true;
          continue;
        }
        results.push(this.parseVideoItem(item));
      }
      if (results.length === 0 && foundLivestream) {
        throw new UnsupportedVideoType("livestream");
      }
      try {
        await storage.updateManyVideoInfo(_.values(results));
      }
      catch (err) {
        log.error(
          `Failed to cache video info, will return metadata anyway: ${err}`
        );
      }
      return results;
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        if (!onlyProperties || onlyProperties.includes("length")) {
          log.warn(
            `Attempting youtube fallback method for ${ids.length} videos`
          );
          try {
            const videos: Video[] = await this.getManyVideoLengthsFallback(ids);
            return videos;
          }
          catch (err) {
            if (err instanceof Error) {
              log.error(`Youtube fallback failed ${err.message} ${err.stack}`);
            }
            else {
              log.error(`Youtube fallback failed, but threw non Error`);
            }
            throw err;
          }
        }
        else {
          log.warn("No fallback method for requested metadata properties");
          throw new OutOfQuotaException("youtube");
        }
      }
      else {
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
        }
        else {
          video.thumbnail = item.snippet.thumbnails.default.url;
        }
      }
    }
    if (item.contentDetails) {
      try {
        video.length = this.parseVideoLength(item.contentDetails.duration);
      }
      catch (e) {
        log.error(`Failed to parse video length. input: "${item.contentDetails.duration}" (type ${typeof item.contentDetails.duration})`);
        throw e;
      }
    }
    return video;
  }

  private async getManyVideoLengthsFallback(ids: string[]) {
    const getLengthPromises = ids.map((id) => this.getVideoLengthFallback(id));
    const results = await Promise.all(getLengthPromises);
    const videos: Video[] = _.zip(ids, results).map(
      ([id, length]) => ({
        service: "youtube",
        id,
        length,
        // HACK: we can guess what the thumbnail url is, but this could possibly change without warning
        thumbnail: `https://i.ytimg.com/vi/${id}/default.jpg`,
      })
    );
    try {
      await storage.updateManyVideoInfo(videos);
    }
    catch (err) {
      if (err instanceof Error) {
        log.error(`Failed to cache video info, returning result anyway: ${err.message} ${err.stack}`);
      }
    }
    return videos;
  }

  private getNeededParts(onlyProperties?: (keyof VideoMetadata)[]) {
    let parts = [];
    if (onlyProperties) {
      if (onlyProperties.includes("title") ||
        onlyProperties.includes("description") ||
        onlyProperties.includes("thumbnail")) {
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
    }
    else {
      parts = ["snippet", "contentDetails"];
    }
    return parts;
  }

  async getVideoLengthFallback(id: string): Promise<number> {
    const url = `https://youtube.com/watch?v=${id}`;
    const res = await this.fallbackApi.get(url);
    const regexs = [
      /length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/, /lengthSeconds":"\d+/,
    ];
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
    return null;
  }

  getChannelId(url: URL): YoutubeChannelData {
    const channelId = (/\/(?!(?:c(?:|hannel)|user)\/)([a-z0-9_-]+)/gi).exec(url.pathname)[1];
    if (url.pathname.startsWith("/channel/")) {
      return { channel: channelId };
    }
    else if (url.pathname.startsWith("/user/")) {
      return { user: channelId };
    }
    else {
      return { customUrl: channelId };
    }
  }

  async searchVideos(query: string, options?: { maxResults: number; }): Promise<Video[]> {
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
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        throw new OutOfQuotaException(this.serviceId);
      }
      else {
        throw err;
      }
    }
  }

  /**
   * Workaround for #285. Feature was requested here: https://issuetracker.google.com/issues/165676622
   */
  async getChannelIdFromYoutubeCustomUrl(customUrl: string): Promise<string | null> {
    log.debug("web scraping to find channel id");
    const res = await this.fallbackApi.get(`https://youtube.com/c/${customUrl}`);
    const regex = /externalId":"UC[A-Za-z0-9_-]{22}/;
    const matches = res.data.match(regex);
    if (matches === null) {
      return null;
    }
    const extracted = matches[0].split(":")[1].substring(1);
    return extracted;
  }

  /**
   * Parse youtube's unconventional video duration format into seconds.
   * Examples: PT40M25S
   */
  parseVideoLength(duration: string): number {
    let match = /PT(\d+H)?(\d+M)?(\d+S)?/.exec(duration);

    match = match.slice(1).map((x) => {
      if (x !== null && x !== undefined) {
        return x.replace(/\D/, '');
      }
    });

    const hours = (parseInt(match[0], 10) || 0);
    const minutes = (parseInt(match[1], 10) || 0);
    const seconds = (parseInt(match[2], 10) || 0);

    return hours * 3600 + minutes * 60 + seconds;
  }
}

module.exports = YouTubeAdapter;
