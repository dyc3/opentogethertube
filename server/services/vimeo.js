const URL = require("url");
const axios = require("axios");
const ServiceAdapter = require("../serviceadapter");
const { InvalidVideoIdException } = require("../exceptions");
const Video = require("../../common/video");
const { getLogger } = require("../../logger");

const log = getLogger("vimeo");

class VimeoAdapter extends ServiceAdapter {
  static SERVICE_ID = "vimeo";

  api = axios.create({
    baseURL: "https://vimeo.com/api/oembed.json",
  });

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("vimeo.com");
  }

  isCollectionURL() {
    return false;
  }

  getVideoId(link) {
    const url = URL.parse(link);
    return url.pathname.split("/").slice(-1)[0].trim();
  }

  async fetchVideoInfo(videoId) {
    if (!/^[0-9]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }

    try {
      const result = await this.api.get("", {
        params: {
          url: `https://vimeo.com/${videoId}`,
        },
      });

      const video = new Video({
        service: this.serviceId,
        id: videoId,
        title: result.data.title,
        description: result.data.description,
        thumbnail: result.data.thumbnail_url,
        length: result.data.duration,
      });

      return video;
    }
    catch (err) {
      if (err.response && err.response.status === 403) {
        log.error("Failed to get video info: Embedding for this video is disabled!");
      }
      throw err;
    }
  }
}

module.exports = VimeoAdapter;
