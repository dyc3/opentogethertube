<template>
  <fragment>
    <YoutubePlayer
      v-if="source.service == 'youtube'"
      ref="youtube"
      v-bind="$attrs"
      :video-id="source.id"
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
      v-bind="$attrs"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <DailymotionPlayer
      v-else-if="source.service == 'dailymotion'"
      ref="dailymotion"
      v-bind="$attrs"
      :video-id="source.id"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <GoogleDrivePlayer
      v-else-if="source.service == 'googledrive'"
      ref="googledrive"
      v-bind="$attrs"
      :video-id="source.id"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <DirectPlayer
      v-else-if="source.service == 'direct'"
      ref="direct"
      v-bind="$attrs"
      :video-id="source.id"
      @playing="$emit('playing')"
      @paused="$emit('paused')"
      @ready="$emit('ready')"
      @buffering="$emit('buffering')"
      @error="$emit('error')"
    />
    <v-container v-else fluid fill-height v-bind="$attrs">
      <v-row justify="center" align="center">
        <v-col cols="auto">
          <h1>No video is playing.</h1>
          <span>Click "Add" below to add a video.</span>
        </v-col>
      </v-row>
    </v-container>
  </fragment>
</template>

<script>
const services = [
  "youtube",
  "vimeo",
  "dailymotion",
  "googledrive",
  "direct",
];

export default {
  name: "omniplayer",
  props: ["source"],
  components: {
    YoutubePlayer: () => import(/* webpackChunkName: "youtube" */"@/components/YoutubePlayer.vue"),
    VimeoPlayer: () => import(/* webpackChunkName: "vimeo" */"@/components/VimeoPlayer.vue"),
    DailymotionPlayer: () => import(/* webpackChunkName: "dailymotion" */"@/components/DailymotionPlayer.vue"),
    GoogleDrivePlayer: () => import(/* webpackChunkName: "googledrive" */"@/components/GoogleDrivePlayer.vue"),
    DirectPlayer: () => import(/* webpackChunkName: "direct" */"@/components/DirectPlayer.vue"),
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
  },
};
</script>
