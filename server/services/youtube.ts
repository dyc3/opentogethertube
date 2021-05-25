import URL, { Url, URLSearchParams } from "url";
import QueryString from "querystring";
import axios from "axios";
import _ from "lodash";
import { RedisClient } from "redis";
import { ServiceAdapter, VideoRequest } from "../serviceadapter";
import { InvalidVideoIdException, OutOfQuotaException } from "../exceptions";
import { getLogger } from "../../logger";
import moment from "moment";
import { Video, VideoId, VideoMetadata } from "../../common/models/video";
import storage from "../../storage";

const log = getLogger("youtube");

const knownPrivateLists = ["LL", "WL"];

const ADD_PREVIEW_PLAYLIST_RESULTS_COUNT = parseInt(process.env.ADD_PREVIEW_PLAYLIST_RESULTS_COUNT) || 40;
const ADD_PREVIEW_SEARCH_RESULTS_COUNT = parseInt(process.env.ADD_PREVIEW_SEARCH_RESULTS_COUNT) || 10;

interface YoutubeChannelData {
  channel?: string
  user?: string
  customUrl?: string
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
    const url = URL.parse(link);
    const query = QueryString.parse(url.query);

    if (url.host.endsWith("youtube.com")) {
      return (url.pathname.startsWith("/watch") && !!query.v) ||
        (url.pathname.startsWith("/channel/") && url.pathname.length > 9) ||
        (url.pathname.startsWith("/user/") && url.pathname.length > 6) ||
        (url.pathname.startsWith("/c/") && url.pathname.length > 3) ||
        (url.pathname.startsWith("/playlist") && !!query.list);
    }
    else if (url.host.endsWith("youtu.be")) {
      return url.pathname.length > 1;
    }
    else {
      return false;
    }
  }

  isCollectionURL(link: string): boolean {
    const url = new URL.URL(link);
    return url.pathname.startsWith("/channel/") ||
      url.pathname.startsWith("/c/") ||
      url.pathname.startsWith("/user/") ||
      url.pathname.startsWith("/playlist") ||
      (!!url.searchParams.get("list") && !knownPrivateLists.includes(url.searchParams.get("list")));
  }

  getVideoId(link: string): string {
    const url = new URL.URL(link);
    if (url.host.endsWith("youtu.be")) {
      return url.pathname.replace("/", "").trim();
    }
    else {
      return url.searchParams.get("v").trim();
    }
  }

  async resolveURL(link: string, onlyProperties: (keyof VideoMetadata)[]): Promise<Video | Video[]> {
    log.debug(`resolveURL: ${link}, ${onlyProperties}`);
    const url = new URL.URL(link);

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
          return this.fetchVideoInfo(this.getVideoId(link), onlyProperties);
        }
      }
      else {
        return this.fetchVideoInfo(this.getVideoId(link), onlyProperties);
      }
    }
  }

  async fetchVideoInfo(id: string, onlyProperties?: (keyof VideoMetadata)[]): Promise<Video> {
    return (await this.videoApiRequest([id], onlyProperties))[0];
  }

  async fetchManyVideoInfo(requests: VideoRequest[]): Promise<Video[]> {
    const groupedByMissingInfo = _.groupBy(requests, request => request.missingInfo);
    const groups = await Promise.all(Object.values(groupedByMissingInfo).map(async group => {
      return await this.videoApiRequest(group.map(request => request.id), group[0].missingInfo);
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

    let parts = [];
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
          `onlyProperties must have valid values or be null! Found ${onlyProperties}`
        );
        throw new Error("onlyProperties must have valid values or be null!");
      }
    }
    else {
      parts = ["snippet", "contentDetails"];
    }
    log.silly(`Requesting ${parts.length} parts for ${ids.length} videos`);
    try {
      const res = await this.api
        .get("/videos", {
          params: {
            key: this.apiKey,
            part: parts.join(","),
            id: ids.join(","),
          },
        });
      const results = {};
      for (let i = 0; i < res.data.items.length; i++) {
        const item = res.data.items[i];
        const video: Video = {
          service: "youtube",
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
          video.length = moment
            .duration(item.contentDetails.duration)
            .asSeconds();
        }
        results[item.id] = video;
      }
      try {
        await storage.updateManyVideoInfo(_.values(results));
      }
      catch (err) {
        log.error(
          `Failed to cache video info, will return metadata anyway: ${err}`
        );
      }
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        if (!onlyProperties || onlyProperties.includes("length")) {
          log.warn(
            `Attempting youtube fallback method for ${ids.length} videos`
          );
          try {
            const getLengthPromises = ids.map((id) => this.getVideoLengthFallback(id));
            const results = await Promise.all(getLengthPromises);
            const videos = _.zip(ids, results).map(
              (i) => ({
                service: "youtube",
                id: i[0],
                length: i[1],
                // HACK: we can guess what the thumbnail url is, but this could possibly change without warning
                thumbnail: `https://i.ytimg.com/vi/${i[0]}/default.jpg`,
              })
            );
            // const finalResult = _.zipObject(ids, videos);
            try {
              await storage.updateManyVideoInfo(videos);
            }
            catch (err) {
              log.error(`Failed to cache video info, returning result anyway: ${err}`);
            }
            return videos;
          }
          catch (err) {
            log.error(`Youtube fallback failed ${err}`);
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
      const match = matches[0];
      const extracted = match.split(":")[1].substring(r === 1 ? 2 : 1);
      log.silly(`MATCH ${match}`);
      log.debug(`EXTRACTED ${extracted}`);
      return parseInt(extracted);
    }
    return null;
  }

  getChannelId(url: URL.URL): YoutubeChannelData {
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
}

module.exports = YouTubeAdapter;
