const URL = require("url");
const ServiceAdapter = require("../serviceadapter");
const { InvalidVideoIdException } = require("../exceptions");

class GoogleDriveAdapter extends ServiceAdapter {
  static SERVICE_ID = "googledrive";

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("drive.google.com");
  }

  async fetchVideoInfo(videoId) {
    if (!/^[A-za-z0-9_-]+$/.exec(videoId)) {
      return Promise.reject(
        new InvalidVideoIdException(this.serviceId, videoId)
      );
    }
  }
}

module.exports = GoogleDriveAdapter;
