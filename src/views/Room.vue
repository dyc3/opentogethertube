<template>
  <v-container class="room">
    <v-layout column>
      <h1>Room</h1>
      <span>{{ connectionStatus }}</span>
    </v-layout>
    <v-layout column justify-center>
      <v-layout wrap class="video-container">
        <v-flex xl8>
          <SyncedVideo class="video" :src="currentSource" :position="playbackPosition" width="853" height="480" ref="video"></SyncedVideo>
          <v-flex column class="video-controls">
            <vue-slider v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.playbackDuration"></vue-slider>
            <v-flex row>
              <v-btn @click="togglePlayback()">Toggle Playback</v-btn>
              <v-btn @click="skipVideo()">Skip</v-btn>
              <v-btn @click="postTestVideo(0)">Add test video 0</v-btn>
              <v-btn @click="postTestVideo(1)">Add test video 1</v-btn>
            </v-flex>
          </v-flex>
        </v-flex>
      </v-layout>
      <div class="video-add">
        <v-text-field placeholder="Video URL to add to queue" ref="inputAddUrl"></v-text-field>
        <v-btn @click="addToQueue">Add</v-btn>
      </div>
      <v-layout column class="video-queue">
        <h3>Queue</h3>
        <ul>
          <li v-for="(url, index) in $store.state.room.queue" :key="index">{{ url }}</li>
        </ul>
      </v-layout>
    </v-layout>
  </v-container>
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
    skipVideo() {
      this.$socket.sendObj({ action: "skip" });
    },
    sliderChange() {
      this.$socket.sendObj({ action: "seek", position: this.sliderPosition });
    },
    addToQueue() {
      API.post("/room/test/queue", {
        url: this.$refs.inputAddUrl.lazyValue
      });
    }
  }
}
</script>

<style lang="scss" scoped>
.video-container {
  // width: 853px;
  margin: 10px;
}
.video-queue {
  margin: 40px;
}
.video-add {
  margin: 10px;
}
</style>
