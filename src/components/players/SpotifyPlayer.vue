<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div id="spotify-player" class="spotify">
    <iframe
      title="spotify-player-iframe"
      id="spotify-player-iframe"
      ref="spotifyPlayerIframe"
      :src="srcUrl"
      width="100%"
      height="100%"
      frameborder="0"
      allowtransparency="true"
      allow="encrypted-media"
    >
    </iframe>
  </div>
</template>

<script>
import axios from "axios";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/me/player";
const SPOTIFY_API_URL_IMPLICIT = "https://accounts.spotify.com/authorize";
// const SPOTIFY_API_LOGIN_URL = "https://accounts.spotify.com/api/token";
// const SPOTIFY_EMBED_URL = "https://open.spotify.com/embed";

export default {
  name: "",
  props: {
    videoId: { type: String, required: true },
  },
  data() {
    return {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      token: null,
      tokenType: null,
      videoType: null,
      iframe: this.$refs.spotifyPlayerIframe,
      srcUrl: null,
      position: 0,
      playState: false,
      volume: 0,
      image: null,
    };
  },
  created() {
    this.initApi();
  },
  mounted() {},
  methods: {
    async initApi() {
      let scope = encodeURIComponent(
          "user-read-playback-state user-modify-playback-state"
        ),
        clientId = encodeURIComponent(this.clientId),
        redirect_uri = encodeURIComponent("http://localhost:8080"),
        state = encodeURIComponent(this.generateRandomString(16));

      // https://developer.spotify.com/documentation/general/guides/authorization-guide/#implicit-grant-flow

      if (localStorage.getItem("spotifyAccessToken") === "undefined") {
        window.location = `${SPOTIFY_API_URL_IMPLICIT}?client_id=${clientId}&redirect_uri=${redirect_uri}&scope=${scope}&response_type=token&state=${state}`;
      }

      const params = this.getHashParams();
      localStorage.setItem("spotifyAccessToken", params.access_token);
      this.token = localStorage.getItem("spotifyAccessToken");
      this.tokenType = "Bearer";
      console.log(this.token);
      this.getCurrentVideoInfo();
    },
    async getCurrentVideoInfo() {
      // https://developer.spotify.com/documentation/web-api/reference/player/get-information-about-the-users-current-playback/
      console.log(this.token);
      if (this.token !== null) {
        const result = await axios({
          url: `${SPOTIFY_API_URL}`,
          method: "get",
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });

        this.position = result.data.progress_ms / 1000;
        this.playState = result.data.is_playing;
        this.videoId = result.data.context.external_urls.spotify
          .split("/")
          .slice(-1)[0]
          .trim();
        this.videoType = result.data.context.type;
        this.volume = result.data.device.volume_percent;
        this.image = result.data.images[0].url;
        this.$emit("ready");
      }
    },

    updateIframe() {
      this.iframe = document.getElementById("spotify-player-iframe");
      this.iframe.src = this.image;
    },
    play() {
      axios({
        url: `${SPOTIFY_API_URL}/play`,
        method: "put",
        data: `uris%5B0%5D=${this.videoId}&position_ms=0`,
        headers: {
          Authorization: `${this.tokenType} ${this.token}`,
        },
      });
      this.$emit("playing");
    },
    pause() {
      axios({
        url: `${SPOTIFY_API_URL}/pause`,
        method: "put",
        headers: {
          Authorization: `${this.tokenType} ${this.token}`,
        },
      });
      this.$emit("paused");
    },
    getPosition() {
      return this.position;
    },
    setPosition(position) {
      if (this.token) {
        axios({
          url: `${SPOTIFY_API_URL}/seek`,
          method: "put",
          data: `position_ms=${position}`,
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });
      }
    },
    setVolume(volume) {
      axios({
        url: `${SPOTIFY_API_URL}/volume`,
        method: "put",
        data: `position_percent=${volume}`,
        headers: {
          Authorization: `${this.tokenType} ${this.token}`,
        },
      }).then(() => {
        this.volume = volume;
      });
      return this.volume;
    },
    getVolume() {
      return this.volume;
    },
    /**
     * Obtains parameters from the hash of the URL
     * @return Object
     */
    getHashParams() {
      let hashParams = {},
        e,
        r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
      while ((e = r.exec(q))) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
      }
      return hashParams;
    },
    /**
     * Generates a random string containing numbers and letters
     * @param  {number} length The length of the string
     * @return {string} The generated string
     */
    generateRandomString(length) {
      let text = "",
        possible =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
    },
  },
  watch: {
    videoId() {
      this.play();
      this.getCurrentVideoInfo();
      this.updateIframe();
    },
  },
};
</script>

<style lang="scss" scoped>
.spotify-player {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  max-width: 100%;

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
