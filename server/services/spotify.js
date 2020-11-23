
const URL = require("url");
const axios = require("axios");

const ServiceAdapter = require("../serviceadapter");

const { getLogger } = require("../../logger");
const log = getLogger("spotify");

class SpotifyAdapter extends ServiceAdapter {
  constructor(apiKey) {
    super();
    this.api
    this.apiKey = apiKey;
  }
  get serviceId() {
    return "spotify";
  }

  canHandleURL(url) {
    const host = URL.parse(url).host;
    return host.endsWith("open.spotify.com") || url.startsWith("spotify:");
  }

  isCollectionURL(url) {
    const pathname = URL.parse(url).pathname;
    return pathname.startsWith("/playlist/") || pathname.startsWith("/album/");
  }

  getVideoId(url) {
    const pathname = URL.parse(url).pathname;
    return pathname.split("/").slice(-1)[0].trim();
  }

  async fetchVideoInfo(Id) {
    const result = await this.api.get(`/video/${videoId}`);
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

  getTrackIdSpotify(url) {
    if (url.startsWith("spotify:")) {
        
    }
    else {
        let urlParsed = URL.parse(url);
        return urlParsed.path.split("/").slice(-1)[0].split("?")[0].trim();
    }
  }

  get isCacheSafe() {
    return false;
  }

  async resolveURL(url) {
    const urlInfo = URL.parse(url);
    if (url.startsWith("spotify:")){

    }
    else if (urlInfo.pathname.startsWith("/album/")) {

    } else if (urlInfo.pathname.startsWith("/playlist/")) {

    } else if (urlInfo.pathname.startsWith("/podcast/")) {

    }
    return [];

  }
}

module.exports = MyServiceAdapter;