<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div id="spotify-player" class="spotify" width="100%" height="100%">
    <img ref="spotifyPlayerIframe" :src="srcUrl" width="100%" height="100%" />
  </div>
</template>

<script>
import axios from "axios";

const SPOTIFY_API_URL = "https://api.spotify.com/v1/me/player";
const SPOTIFY_API_URL_IMPLICIT = "https://accounts.spotify.com/authorize";
// const SPOTIFY_EMBED_URL = "https://open.spotify.com/embed";

export default {
  name: "",
  props: {
    videoId: { type: String, required: true },
  },
  data() {
    return {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      token: null,
      tokenType: null,
      videoType: this.videoId.split(":")[0],
      iframe: this.$refs.spotifyPlayerIframe,
      srcUrl: null,
      position: 1,
      playState: false,
      volume: 0,
      image: null,
      videoID: this.videoId.split(":")[1],
    };
  },
  created() {
    this.initApi();
  },
  beforeDestroy() {
    if (this.token) {
      this.pause();
    }
  },
  mounted() {},
  methods: {
    async initApi() {
      const scope = encodeURIComponent(
          "user-read-playback-state user-modify-playback-state"
        ),
        clientId = encodeURIComponent(this.clientId),
        redirect_uri = encodeURIComponent(
          `${window.location.origin}/api/spotify/authentication`
        ),
        state = encodeURIComponent(window.location.href);
      if (window.location.search === "" && this.token === null) { // TODO if token in session don't redirect
        // https://developer.spotify.com/documentation/general/guides/authorization-guide/#authorization-code-flow
          window.location = `${SPOTIFY_API_URL_IMPLICIT}?client_id=${clientId}&redirect_uri=${redirect_uri}&scope=${scope}&response_type=code&state=${state}`;
      } 
      else {
        const spotifyAuthResponse = new URLSearchParams(window.location.search);

        const result = await axios({
          url: `${window.location.origin}/api/spotify/token`,
          method: "post",
          data: spotifyAuthResponse,
        });

        this.token = result.data.token;
        this.tokenType = result.data.tokenType;
      }
    },
    async getCurrentVideoInfo() {
      // https://developer.spotify.com/documentation/web-api/reference/player/get-information-about-the-users-current-playback/
      if (this.token !== null) {
        const result = await axios({
          url: `${SPOTIFY_API_URL}`,
          method: "get",
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });

        this.position = Math.round(result.data.progress_ms);
        this.playState = result.data.is_playing;
        this.volume = result.data.device.volume_percent;
        this.image = result.data.item.album.images[0].url;
        this.$emit("ready");
        this.updateIframe();
      }
    },

    updateIframe() {
      this.srcUrl = this.image;
    },
    play() {
      if (this.playState === false) {
        axios({
          url: `${SPOTIFY_API_URL}/play`,
          method: "put",
          data: {
            uris: [`spotify:${this.videoType}:${this.videoID}`],
            position_ms: this.position,
          },
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });
        this.$emit("playing");
      }
      this.playState = true;
      this.getCurrentVideoInfo();
    },
    pause() {
      if (this.playState !== false) {
        axios({
          url: `${SPOTIFY_API_URL}/pause`,
          method: "put",
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });
        this.$emit("paused");
        this.playState = false;
      }
    },
    getPosition() {
      return Math.round(this.position);
    },
    setPosition(position) {
      if (this.token && this.playState !== false && position % 1000 === 0) {
        // testing value
        axios({
          url: `${SPOTIFY_API_URL}/seek?position_ms=${Math.round(position)}`,
          method: "put",
          headers: {
            Authorization: `${this.tokenType} ${this.token}`,
          },
        });
      }
    },
    setVolume(volume) {
      axios({
        url: `${SPOTIFY_API_URL}/volume?volume_percent=${volume}`,
        method: "put",
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
    onReady() {
      this.$emit("ready");
    },
  },
  watch: {
    videoID() {
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
