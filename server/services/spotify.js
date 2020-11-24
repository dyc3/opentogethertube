const URL = require("url");
const axios = require("axios");
const { Base64 } = require('js-base64');
const qs = require('qs');

const ServiceAdapter = require("../serviceadapter");
const Video = require("../../common/video");

const { getLogger } = require("../../logger");
const { url } = require("inspector");
const log = getLogger("spotify");


class SpotifyAdapter extends ServiceAdapter {
  constructor(clientId, clientSecret) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiUrl = "https://api.spotify.com/v1/"
    this.apiLoginUrl = "https://accounts.spotify.com/api/token"
    this.token = null;
    this.tokenType = null;
    this.videoId = null;
    this.videoType = null;
    this.initApi()

  }

  async initApi() {

    const result = await axios({
      url: this.apiLoginUrl,
      method: 'post',
      data: qs.stringify({
        'grant_type': 'client_credentials'
      }),
      headers: {
        'Authorization': `Basic ${Base64.encode(this.clientId + ":" + this.clientSecret)}`,
      },
    });

    this.token = result.data.access_token
    this.tokenType = result.data.token_type
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
    if (url.startsWith("spotify:")) {
      this.videoType = url.split(":")[1]
      this.videoId = url.split(":")[2];
      return url.split(":")[2];
    }
    else {
      const pathname = URL.parse(url).pathname;
      this.videoType = pathname.split("/")[1]
      this.videoId = pathname.split("/").slice(-1)[0].trim();
      return pathname.split("/").slice(-1)[0].trim();
    }
  }

  async fetchVideoInfo(Id) {
    const self = this;
    const result = await axios({
      url:`${this.apiUrl}${this.videoType + 's'}/${this.videoId}?market=ES`,
      method: 'get',
      headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `${this.tokenType} ${this.token}`
      }
      });

    const video = new Video({
      service: this.serviceId,
      id: this.videoId,
      title: result.data.name,
      description: `${result.data.type} ${result.data.name} ${Math.floor((result.data.duration_ms / 1000 / 60) << 0) + ':' + Math.floor((result.data.duration_ms / 1000) % 60)}`,
      thumbnail: result.data.album.images[2].url,
      length: result.data.duration_ms * 1000,
    });
    return video;
  }

  get isCacheSafe() {
    return false;
  }

  async resolveURL(url) {
  }
}

module.exports = SpotifyAdapter;