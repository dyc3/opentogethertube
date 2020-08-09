const URL = require("url");
const ServiceAdapter = require("../serviceadapter");
const { InvalidVideoIdException } = require("../exceptions");

class DailyMotionAdapter extends ServiceAdapter {
  static SERVICE_ID = "dailymotion";

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("dailymotion.com") || url.host.endsWith("dai.ly");
  }

  async fetchVideoInfo(videoId) {
    if (!/^[A-za-z0-9]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }
  }
}

module.exports = DailyMotionAdapter;
