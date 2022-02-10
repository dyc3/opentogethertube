<template>
  <div>
    <YoutubePlayer
      v-if="source.service == 'youtube'"
      ref="youtube"
      :video-id="source.id"
      class="player"
      @apiready="$emit('apiready')"
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
      @apiready="$emit('apiready')"
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
      @apiready="$emit('apiready')"
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
      @apiready="$emit('apiready')"
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
      @apiready="$emit('apiready')"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
      @buffer-progress="onBufferProgress"
      @buffer-spans="timespans => $emit('buffer-spans', timespans)"
    />
    <GenericHlsPlayer
      v-else-if="source.service == 'reddit'"
      ref="reddit"
      :videoid="source.id"
      :hls-url="source.hls_url"
      :thumbnail="source.thumbnail"
      class="player"
      @apiready="$emit('apiready')"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
      @buffer-progress="onBufferProgress"
      @buffer-spans="timespans => $emit('buffer-spans', timespans)"
    />
    <GenericHlsPlayer
      v-else-if="source.service == 'tubi'"
      ref="tubi"
      :videoid="source.id"
      :hls-url="source.hls_url"
      :thumbnail="source.thumbnail"
      class="player"
      @apiready="$emit('apiready')"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
      @buffer-progress="onBufferProgress"
      @buffer-spans="timespans => $emit('buffer-spans', timespans)"
    />
    <v-container v-else fluid fill-height>
      <v-row justify="center" align="center">
        <v-col cols="auto">
          <h1>{{ $t("video.no-video") }}</h1>
          <span>{{ $t("video.no-video-text") }}</span>
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
  "reddit",
  "tubi",
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
    GenericHlsPlayer: () => import(/* webpackChunkName: "hls" */"@/components/players/GenericHlsPlayer.vue"),
  },
  methods: {
    player() {
      // This can't be a computed property because of a race condition. see #355
      if (services.includes(this.source.service)) {
        return this.$refs[this.source.service];
      }

      return null;
    },
    play() {
      return this.player()?.play();
    },
    pause() {
      return this.player()?.pause();
    },
    setVolume(volume) {
      return this.player()?.setVolume(volume);
    },
    getPosition() {
      return this.player()?.getPosition();
    },
    setPosition(position) {
      return this.player()?.setPosition(position);
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
