<template>
  <div class="room">
    <h1>Room</h1>
    <span>{{ connectionStatus }}</span>
    <SyncedVideo :src="currentSource"></SyncedVideo>
    <button @click="manualSyncRoom()">Sync</button>
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
    }
  },
  created() {

  },
  methods: {
    manualSyncRoom() {
      API.get("/room/test").then(res => {
        this.videoSource = res.data.currentVideo;
      });
    },
    postTestVideo() {
      API.post("/room/test/queue", {
        url: "https://www.youtube.com/watch?v=Kf8Jf8dzUDg"
      });
    }
  }
}
</script>
