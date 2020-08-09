const URL = require("url");
const ServiceAdapter = require("../serviceadapter");
const { InvalidVideoIdException } = require("../exceptions");

class VimeoAdapter extends ServiceAdapter {
  static SERVICE_ID = "vimeo";

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("vimeo.com");
  }

  async fetchVideoInfo(videoId) {
    if (!/^[0-9]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }
  }
}

module.exports = VimeoAdapter;
