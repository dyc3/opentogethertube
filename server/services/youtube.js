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
const { request } = require("express");

const log = getLogger("youtube");

class YouTubeAdapter extends ServiceAdapter {
  static SERVICE_ID = "youtube";

  constructor(apiKey) {
    super();

    this.apiKey = apiKey;
    this.api = axios.create({
      baseURL: "https://www.googleapis.com/youtube/v3",
    });
    this.fallbackApi = axios.create();
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("youtube.com") || url.host.endsWith("youtu.be");
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

  fetchVideoInfo(ids, onlyProperties = null) {
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

  fetchManyVideoInfo(requests) {
    const groupedByMissingInfo = _.groupBy(requests, request => request.missingInfo);
    return Promise.all(Object.values(groupedByMissingInfo).map(group => {
      return this.fetchVideoInfo(group.map(request => request.id), group[0].missingInfo);
    }));
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
}

module.exports = YouTubeAdapter;
