const URL = require("url");
const QueryString = require("querystring");
const axios = require("axios");
import { ServiceAdapter } from "../serviceadapter";
const { InvalidVideoIdException, OutOfQuotaException } = require("../exceptions");
const Video = require("../../common/video");
const { getLogger } = require("../../logger");

const log = getLogger("googledrive");

class GoogleDriveAdapter extends ServiceAdapter {
  api = axios.create({
    baseURL: "https://www.googleapis.com/drive/v3",
  });

  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  get serviceId() {
    return "googledrive";
  }

  canHandleURL(link) {
    const url = URL.parse(link);
    return url.host.endsWith("drive.google.com");
  }

  isCollectionURL(link) {
    const url = URL.parse(link);
    return this.isFolderURL(url);
  }

  isFolderURL(url) {
    return url.pathname.startsWith("/drive");
  }

  getVideoId(link) {
    const url = URL.parse(link);
    return this.getVideoIdFromURL(url);
  }

  getFolderId(url) {
    if (/^\/drive\/u\/\d\/folders\//.exec(url.path)) {
      return url.path.split("/")[5].split("?")[0].trim();
    }
    else if (url.path.startsWith("/drive/folders")) {
      return url.path.split("/")[3].split("?")[0].trim();
    }
    else {
      throw new Error("Invalid google drive folder");
    }
  }

  getVideoIdFromURL(url) {
    if (url.pathname.startsWith("/file/d/")) {
      return url.pathname.split("/")[3];
    }
    else {
      const query = QueryString.parse(url.query);
      return query.id;
    }
  }

  async fetchVideoInfo(videoId) {
    if (!/^[A-za-z0-9_-]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }

    try {
      const result = await this.api.get(`/files/${videoId}`, {
        params: {
          key: this.apiKey,
          fields: "id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis)",
        },
      });

      const video = this.parseFile(result.data);
      return video;
    }
    catch (err) {
      if (err.response && err.response.data.error) {
        log.error(`Failed to get video metadata: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
      }
      throw err;
    }
  }

  async fetchFolderVideos(folderId) {
    try {
      const result = await this.api.get("/files", {
        params: {
          key: this.apiKey,
          q: `${folderId}+in+parents`,
          fields: "files(id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis))",
        },
      });
      log.info(`Found ${result.data.files.length} items in folder`);
      return result.data.files.map(item => this.parseFile(item));
    }
    catch (err) {
      if (err.response && err.response.data.error && err.response.data.error.errors[0].reason === "dailyLimitExceeded") {
        throw new OutOfQuotaException(this.serviceId);
      }
      if (err.response && err.response.data.error) {
        log.error(`Failed to get google drive folder: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
      }
      throw err;
    }
  }

  async resolveURL(link) {
    const url = URL.parse(link);

    if (this.isFolderURL(url)) {
      const folderId = this.getFolderId(url);
      return this.fetchFolderVideos(folderId);
    }
    else {
      const videoId = this.getVideoIdFromURL(url);
      return this.fetchVideoInfo(videoId);
    }
  }

  parseFile(file) {
    return new Video({
      service: "googledrive",
      id: file.id,
      title: file.name,
      thumbnail: file.thumbnailLink,
      length: Math.ceil(file.videoMediaMetadata.durationMillis / 1000),
      mime: file.mimeType,
    });
  }
}

module.exports = GoogleDriveAdapter;
