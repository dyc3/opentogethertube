const URL = require("url");
const ServiceAdapter = require("../serviceadapter");

class YouTubeAdapter extends ServiceAdapter {
  get serviceId() {
    return "youtube";
  }

  canHandleLink(link) {
    const url = URL.parse(link);
    return url.host.endsWith("youtube.com") || url.host.endsWith("youtu.be");
  }
}

module.exports = YouTubeAdapter;
