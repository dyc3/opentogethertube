const URL = require("url");
const QueryString = require("querystring");
const axios = require("axios");
const _ = require("lodash");
const ServiceAdapter = require("../serviceadapter");
const {
  InvalidVideoIdException,
  OutOfQuotaException,
} = require("../exceptions");
const { getLogger } = require("../../logger");
const moment = require("moment");
const Video = require("../../common/video");
const storage = require("../../storage");

const log = getLogger("youtube");

class YouTubeAdapter extends ServiceAdapter {
  constructor(apiKey, redisClient) {
    super();

    this.apiKey = apiKey;
    this.api = axios.create({
      baseURL: "https://www.googleapis.com/youtube/v3",
    });
    this.fallbackApi = axios.create();
    this.redisClient = redisClient;
    this.maxResults = 30;
  }

  get serviceId() {
    return "youtube";
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    const query = QueryString.parse(url.query);

    if (url.host.endsWith("youtube.com")) {
      return (url.pathname.startsWith("/watch") && query.v != null) ||
        (url.pathname.startsWith("/channel/") && url.pathname.length > 9) ||
        (url.pathname.startsWith("/user/") && url.pathname.length > 6) ||
        (url.pathname.startsWith("/c/") && url.pathname.length > 3) ||
        (url.pathname.startsWith("/playlist") && query.list != null);
    }
    else if (url.host.endsWith("youtu.be")) {
      return url.pathname.length > 1;
    }
    else {
      return false;
    }
  }

  isCollectionURL(link) {
    const url = URL.parse(link);
    const query = QueryString.parse(url.query);
    return url.pathname.startsWith("/channel/") ||
      url.pathname.startsWith("/c/") ||
      url.pathname.startsWith("/user/") ||
      url.pathname.startsWith("/playlist") ||
      query.list != null;
  }

  getVideoId(str) {
    const url = URL.parse(str);
    if (url.host.endsWith("youtu.be")) {
      return url.pathname.replace("/", "").trim();
    }
    else {
      const query = QueryString.parse(url.query);
      return query.v.trim();
    }
  }

  async resolveURL(link, onlyProperties) {
    const url = URL.parse(link);
    const query = QueryString.parse(url.query);

    if (url.pathname.startsWith("/channel/") || url.pathname.startsWith("/user/")) {
      return this.fetchChannelVideos(this.getChannelId(url));
    }
    else if (url.pathname === "/watch") {
      if (query.list) {
        return this.fetchVideoWithPlaylist(query.v, query.list);
      }
      else {
        return this.fetchVideoInfo(query.v, onlyProperties);
      }
    }
    else if (url.pathname === "/playlist") {
      return this.fetchPlaylistVideos(query.list);
    }
    else if (url.host.endsWith("youtu.be")) {
      return this.fetchVideoInfo(url.pathname, onlyProperties);
    }
  }

  async fetchVideoInfo(id, onlyProperties = null) {
    return (await this.videoApiRequest([id], onlyProperties))[id];
  }

  async fetchManyVideoInfo(requests) {
    const groupedByMissingInfo = _.groupBy(requests, request => request.missingInfo);
    const groups = await Promise.all(Object.values(groupedByMissingInfo).map(group => {
      return this.videoApiRequest(group.map(request => request.id), group[0].missingInfo);
    }));
    const results = Object.values(groups.flat()[0]);
    return results;
  }

  async fetchChannelVideos(channelData) {
    const cachedPlaylistId = await this.getCachedPlaylistId(channelData);
    if (cachedPlaylistId) {
      log.info("Using cached uploads playlist id");
      return this.fetchPlaylistVideos(cachedPlaylistId);
    }

    const channelIdProp = channelData.channel ? "id" : "forUsername";
    const channelIdValue = channelData.channel ? channelData.channel : channelData.user;
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
          user: channelData.user,
          channel: res.data.items[0].id,
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

  getCachedPlaylistId(channelData) {
    return new Promise((resolve, reject) => {
      const redisKey = `ytchannel${_.keys(channelData)[0]}:${_.values(channelData)[0]})`;
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

  cachePlaylistId(channelData, playlistId) {
    if (channelData.channel) {
      const idProp = "channel";
      const idValue = channelData[idProp];
      this.redisClient.set(`ytchannel:${idProp}:${idValue}`, playlistId, (err) => {
        if (err) {
          log.error(`Failed to cache playlist ID: ${err}`);
        }
        else {
          log.info(`Cached playlist ytchannel:${idProp}:${idValue}`);
        }
      });
    }
    if (channelData.user) {
      const idProp = "user";
      const idValue = channelData[idProp];
      this.redisClient.set(`ytchannel:${idProp}:${idValue}`, playlistId, (err) => {
        if (err) {
          log.error(`Failed to cache playlist ID: ${err}`);
        }
        else {
          log.info(`Cached playlist ytchannel:${idProp}:${idValue}`);
        }
      });
    }
  }

  async fetchPlaylistVideos(playlistId) {
    try {
      const res = await this.api.get("/playlistItems", {
        params: {
          key: this.apiKey,
          part: "snippet",
          playlistId: playlistId,
          maxResults: this.maxResults,
        },
      });

      const results = [];
      for (const item of res.data.items) {
        const video = new Video({
          service: this.serviceId,
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
        });
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

  async fetchVideoWithPlaylist(videoId, playlistId) {
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

  videoApiRequest(ids, onlyProperties = null) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    for (const id of ids) {
      if (!/^[A-za-z0-9_-]+$/.exec(id)) {
        return Promise.reject(new InvalidVideoIdException(this.serviceId, id));
      }
    }

    return new Promise((resolve, reject) => {
      let parts = [];
      if (onlyProperties !== null) {
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
          reject(
            new Error("onlyProperties must have valid values or be null!")
          );
          return;
        }
      }
      else {
        parts = ["snippet", "contentDetails"];
      }
      log.silly(`Requesting ${parts.length} parts for ${ids.length} videos`);
      this.api
        .get("/videos", {
          params: {
            key: this.apiKey,
            part: parts.join(","),
            id: ids.join(","),
          },
        })
        .then((res) => {
          let results = {};
          for (let i = 0; i < res.data.items.length; i++) {
            let item = res.data.items[i];
            let video = new Video({
              service: "youtube",
              id: item.id,
            });
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

          // update cache
          // for (let video of _.values(results)) {
          // 	storage.updateVideoInfo(video);
          // }
          // resolve(results);

          storage
            .updateManyVideoInfo(_.values(results))
            .then(() => {
              resolve(results);
            })
            .catch((err) => {
              log.error(
                `Failed to cache video info, will return metadata anyway: ${err}`
              );
              resolve(results);
            });
        })
        .catch((err) => {
          if (err.response && err.response.status === 403) {
            if (!onlyProperties || onlyProperties.includes("length")) {
              log.warn(
                `Attempting youtube fallback method for ${ids.length} videos`
              );
              let getLengthPromises = ids.map((id) => this.getVideoLengthFallback(id));
              Promise.all(getLengthPromises)
                .then((results) => {
                  let videos = _.zip(ids, results).map(
                    (i) => new Video({
                      service: "youtube",
                      id: i[0],
                      length: i[1],
                      // HACK: we can guess what the thumbnail url is, but this could possibly change without warning
                      thumbnail: `https://i.ytimg.com/vi/${i[0]}/default.jpg`,
                    })
                  );
                  let finalResult = _.zipObject(ids, videos);
                  storage
                    .updateManyVideoInfo(videos)
                    .then(() => {
                      resolve(finalResult);
                    })
                    .catch((err) => {
                      log.error(
                        `Failed to cache video info, will return metadata anyway: ${err}`
                      );
                      resolve(finalResult);
                    });
                })
                .catch((err) => {
                  log.error(`Youtube fallback failed ${err}`);
                  reject(err);
                });
            }
            else {
              log.warn("No fallback method for requested metadata properties");
              reject(new OutOfQuotaException("youtube"));
            }
          }
          else {
            reject(err);
          }
        });
    });
  }

  async getVideoLengthFallback(id) {
    let url = `https://youtube.com/watch?v=${id}`;
    let res = await this.fallbackApi.get(url);
    let regexs = [/length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/];
    for (let r = 0; r < regexs.length; r++) {
      let matches = res.data.match(regexs[r]);
      if (matches == null) {
        continue;
      }
      const match = matches[0];
      let extracted = match.split(":")[1].substring(r == 0 ? 1 : 2);
      log.silly(`MATCH ${match}`);
      log.debug(`EXTRACTED ${extracted}`);
      return parseInt(extracted);
    }
    return null;
  }

  getChannelId(url) {
    const channelId = (/\/(?!(?:c(?:|hannel)|user)\/)([a-z0-9_-]+)/gi).exec(url.path)[1];
    if (url.pathname.startsWith("/channel/")) {
      return { channel: channelId };
    }
    else {
      return { user: channelId };
    }
  }

  async searchVideos(query, options = {}) {
    options = _.defaults(options, {
      maxResults: 8,
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
    if (options.fromUser) {
      params.quotaUser = options.fromUser;
    }

    try {
      const res = await this.api.get("/search", { params });
      const results = res.data.items.map(searchResult => new Video({
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
}

module.exports = YouTubeAdapter;
