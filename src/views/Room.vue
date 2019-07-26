<template>
  <div class="room">
    <h1>Room</h1>
    <span>{{ connectionStatus }}</span>
    <SyncedVideo :src="currentSource" :position="playbackPosition"></SyncedVideo>
    <button @click="togglePlayback()">Toggle Playback</button>
    <button @click="postTestVideo()">Add test video</button>
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
    }
  },
  created() {

  },
  methods: {
    postTestVideo() {
      API.post("/room/test/queue", {
        url: "https://www.youtube.com/watch?v=cHpbcnCsl00"
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
    }
  }
}
</script>
