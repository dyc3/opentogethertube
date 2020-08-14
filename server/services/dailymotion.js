const URL = require("url");
const axios = require("axios");
const ServiceAdapter = require("../serviceadapter");
const { InvalidVideoIdException } = require("../exceptions");
const Video = require("../../common/video");

class DailyMotionAdapter extends ServiceAdapter {
  api = axios.create({
    baseURL: "https://api.dailymotion.com",
  });

  get serviceId() {
    return "dailymotion";
  }

  canHandleLink(link) {
    const url = URL.parse(link);

    return (
      (url.host.endsWith("dailymotion.com") && url.pathname.startsWith("/video/")) ||
      (url.host.endsWith("dai.ly") && url.pathname.length > 1)
    );
  }

  isCollectionURL() {
    return false;
  }

  getVideoId(link) {
    const url = URL.parse(link);
    return url.pathname.split("/").slice(-1)[0].trim();
  }

  async fetchVideoInfo(videoId) {
    if (!/^[A-za-z0-9]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }

    const result = await this.api.get(`/video/${videoId}`, {
      params: {
        fields: "title,description,thumbnail_url,duration",
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
}

module.exports = DailyMotionAdapter;
