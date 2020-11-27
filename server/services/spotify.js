const URL = require("url");
const axios = require("axios");

const ServiceAdapter = require("../serviceadapter");
const Video = require("../../common/video");

const { getLogger } = require("../../logger");
const log = getLogger("spotify");

class SpotifyAdapter extends ServiceAdapter {
  constructor(clientId, clientSecret) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiUrl = "https://api.spotify.com/v1/";
    this.apiLoginUrl = "https://accounts.spotify.com/api/token";
    this.token = null;
    this.tokenType = null;
    this.videoType = null;
    this.initApi();

  }

  async initApi() {
    // https://developer.spotify.com/documentation/general/guides/authorization-guide/#client-credentials-flow
    log.info(`Authorization: Basic ${Buffer.from(this.clientId + ":" + this.clientSecret).toString('base64')}`);
    var that = this;
    const result = await axios({
      url: this.apiLoginUrl,
      method: 'post',
      data: "grant_type=client_credentials",
      headers: {
        'Authorization': `Basic ${Buffer.from(this.clientId + ":" + this.clientSecret).toString('base64')}`,
      },
    }).catch(function (error) {
      log.debug(`Authorization: Basic ${Buffer.from(that.clientId + ":" + that.clientSecret).toString('base64')}`);
      log.error(`Spotify login token for api failed ${error.response.status} ${error.response.data}`);
      if (error.request) {
        log.error(`Spotify login token for api failed ${error.request}`);  
      }
    });
    this.token = result.data.access_token;
    this.tokenType = result.data.token_type;
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
    return pathname.startsWith("/playlist/") || pathname.startsWith("/album/") || pathname.startsWith("/show/");
  }

  getVideoId(url) {
    if (url.startsWith("spotify:")) {
      this.videoType = url.split(":")[1];
      return `${url.split(":")[1]}:${url.split(":")[2]}`;
    }
    else {
      const pathname = URL.parse(url).pathname;
      this.videoType = pathname.split("/")[1];
      return `${pathname.split("/")[1]}:${pathname.split("/").slice(-1)[0].trim()}`;
    }
  }

  async fetchVideoInfo(Id) {
    // https://developer.spotify.com/console/get-track/?id=6sGiI7V9kgLNEhPIxEJDii&market=ES
    const result = await axios({
      url:`${this.apiUrl}${this.videoType + 's'}/${Id.split(":")[1]}`,
      method: 'get',
      headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `${this.tokenType} ${this.token}`,
      },
      }).catch((error) => {
        log.error(`Spotify Fetch info failed ${error.response.status.toString()} ${error.response.data.toString()}`);
        if (error.request) {
          log.error(`Spotify Fetch info failed ${error.request.toString()}`);  
        }
      });
    
      log.debug(`Description time: ${Math.floor((result.data.duration_ms / 1000 / 60) << 0) + ':' + Math.floor((result.data.duration_ms / 1000) % 60)}`);
    
    const video = new Video({
      service: this.serviceId,
      id: Id,
      title: result.data.name,
      description: `${result.data.type} ${result.data.name} ${Math.floor((result.data.duration_ms / 1000 / 60) << 0) + ':' + Math.floor((result.data.duration_ms / 1000) % 60)}`,
      thumbnail: result.data.album.images[2].url,
      length: Math.round(result.data.duration_ms/1000),
    });
    return video;
  }

  get isCacheSafe() {
    return true;
  }

  async resolveURL(url) {
    log.debug(`url`);
    return [];
  }
}

module.exports = SpotifyAdapter;
