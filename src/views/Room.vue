<template>
  <div class="room">
    <h1>Room</h1>
    <span>{{ connectionStatus }}</span>
    <SyncedVideo :src="videoSource"></SyncedVideo>
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
      if (this.$socket.readyState == 1) {
        return "Connected";
      }
      else {
        return "Connecting...";
      }
    }
  },
  created() {
    // this.manualSyncRoom();
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
  },
  // these are called when websocket messages are received
  actions: {
    sync(context) {
      console.log("SYNC", context);
      // this.$socket.sendObj({ example: "object" });
    }
  }
}
</script>
