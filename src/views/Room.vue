<template>
  <div class="room">
    <h1>Room</h1>
    <span>{{ connectionStatus }}</span>
    <SyncedVideo :src="currentSource" :position="playbackPosition" ref="video"></SyncedVideo>
    <vue-slider v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.playbackDuration"></vue-slider>
    <button @click="togglePlayback()">Toggle Playback</button>
    <button @click="postTestVideo(0)">Add test video 0</button>
    <button @click="postTestVideo(1)">Add test video 1</button>
  </div>
</template>

<script>
import SyncedVideo from "@/components/SyncedVideo.vue";
import { API } from "@/common-http.js";

export default {
  name: 'room',
  components: {
    SyncedVideo
  },
  data() {
    return {
      videoSource: "",
      sliderPosition: 0
    }
  },
  computed: {
    connectionStatus() {
      if (this.$store.state.socket.isConnected) {
        return "Connected";
      }
      else {
        return "Connecting...";
      }
    },
    currentSource() {
      return this.$store.state.room.currentSource;
    },
    playbackPosition() {
      return this.$store.state.room.playbackPosition;
    },
    playbackPercentage() {
      return this.$store.state.room.playbackPosition / this.$store.state.room.playbackDuration;
    }
  },
  created() {
    this.$events.on("onSync", () => {
      this.sliderPosition = this.$store.state.room.playbackPosition;
    });
  },
  methods: {
    postTestVideo(v) {
      let videos = [
        "https://www.youtube.com/watch?v=cHpbcnCsl00",
        "https://www.youtube.com/watch?v=aI67KDJRnvQ"
      ];
      API.post("/room/test/queue", {
        url: videos[v]
      });
    },
    togglePlayback() {
      if (this.$store.state.room.isPlaying) {
        // this.$events.emit("pauseVideo");
        this.$socket.sendObj({ action: "pause" });
      }
      else {
        // this.$events.emit("playVideo");
        this.$socket.sendObj({ action: "play" });
      }
    },
    sliderChange() {
      this.$socket.sendObj({ action: "seek", position: this.sliderPosition });
    }
  }
}
</script>

<style lang="scss" scoped>

</style>
