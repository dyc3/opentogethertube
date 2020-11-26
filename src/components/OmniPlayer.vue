<template>
  <div>
    <YoutubePlayer
      v-if="source.service == 'youtube'"
      ref="youtube"
      :video-id="source.id"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <VimeoPlayer
      v-else-if="source.service == 'vimeo'"
      ref="vimeo"
      :video-id="source.id"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <DailymotionPlayer
      v-else-if="source.service == 'dailymotion'"
      ref="dailymotion"
      :video-id="source.id"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <GoogleDrivePlayer
      v-else-if="source.service == 'googledrive'"
      ref="googledrive"
      :video-id="source.id"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <DirectPlayer
      v-else-if="source.service == 'direct'"
      ref="direct"
      :video-url="source.id"
      :video-mime="source.mime"
      :thumbnail="source.thumbnail"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
      @buffer-progress="onBufferProgress"
      @buffer-spans="timespans => $emit('buffer-spans', timespans)"
    />
    <SpotifyPlayer
      v-else-if="source.service == 'spotify'"
      ref="spotify"
      :video-id="source.id"
      :video-type="source.type"
      class="player"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @error="$emit('error')"
      @buffering="$emit('buffering')"
    />
    <v-container v-else fluid fill-height>
      <v-row justify="center" align="center">
        <v-col cols="auto">
          <h1>No video is playing.</h1>
          <span>Click "Add" below to add a video.</span>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script>
const services = [
  "youtube",
  "vimeo",
  "dailymotion",
  "googledrive",
  "direct",
  "spotify",
];

export default {
  name: "omniplayer",
  props: ["source"],
  components: {
    YoutubePlayer: () => import(/* webpackChunkName: "youtube" */"@/components/players/YoutubePlayer.vue"),
    VimeoPlayer: () => import(/* webpackChunkName: "vimeo" */"@/components/players/VimeoPlayer.vue"),
    DailymotionPlayer: () => import(/* webpackChunkName: "dailymotion" */"@/components/players/DailymotionPlayer.vue"),
    GoogleDrivePlayer: () => import(/* webpackChunkName: "googledrive" */"@/components/players/GoogleDrivePlayer.vue"),
    DirectPlayer: () => import(/* webpackChunkName: "direct" */"@/components/players/DirectPlayer.vue"),
    SpotifyPlayer: () => import(/* webpackChunkName: "direct" */"@/components/players/SpotifyPlayer.vue"),
  },
  computed: {
    player() {
      if (services.includes(this.source.service)) {
        return this.$refs[this.source.service];
      }

      return null;
    },
  },
  methods: {
    play() {
      return this.player?.play();
    },
    pause() {
      return this.player?.pause();
    },
    setVolume(volume) {
      return this.player?.setVolume(volume);
    },
    getPosition() {
      return this.player?.getPosition();
    },
    setPosition(position) {
      return this.player?.setPosition(position);
    },
    onBufferProgress(percent) {
      this.$store.commit("PLAYBACK_BUFFER", percent);
    },
  },
};
</script>

<style lang="scss" scoped>
.player {
  width: 100%;
  height: 100%;
}
</style>
