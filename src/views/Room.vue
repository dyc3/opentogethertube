<template>
  <v-container class="room">
    <v-layout column>
      <h1>{{ $store.state.room.title != "" ? $store.state.room.title : ($store.state.room.isTemporary ? "Temporary Room" : $store.state.room.name) }}</h1>
      <span>{{ connectionStatus }}</span>
    </v-layout>
    <v-layout column justify-center>
      <v-layout wrap class="video-container">
        <v-flex xl8>
          <SyncedVideo class="video" :src="currentSource" :position="playbackPosition" :volume="volume" width="853" height="480" ref="video"></SyncedVideo>
          <v-flex column class="video-controls">
            <vue-slider v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.playbackDuration"></vue-slider>
            <v-flex row align-center>
              <v-btn @click="togglePlayback()">
                <v-icon v-if="$store.state.room.isPlaying">fas fa-pause</v-icon>
                <v-icon v-else>fas fa-play</v-icon>
              </v-btn>
              <v-btn @click="skipVideo()">
                <v-icon>fas fa-fast-forward</v-icon>
              </v-btn>
              <vue-slider v-model="volume" style="width: 150px; margin-left: 10px"></vue-slider>
            </v-flex>
          </v-flex>
        </v-flex>
      </v-layout>
      <div class="video-add">
        <v-text-field placeholder="Video URL to add to queue" ref="inputAddUrl"></v-text-field>
        <v-btn @click="addToQueue">Add</v-btn>
        <v-btn @click="postTestVideo(0)">Add test video 0</v-btn>
        <v-btn @click="postTestVideo(1)">Add test video 1</v-btn>
      </div>
      <v-layout>
        <v-flex row>
          <v-flex column class="video-queue">
            <h3>Queue</h3>
            <v-card v-for="(url, index) in $store.state.room.queue" :key="index" style="margin-top: 10px">
              <v-card-text>{{ url }}</v-card-text>
            </v-card>
          </v-flex>
          <v-flex column md2 class="user-list">
            <v-card>
              <v-subheader>
                Users
                <v-btn icon x-small @click="openEditName"><v-icon>fas fa-cog</v-icon></v-btn>
              </v-subheader>
              <v-list-item v-if="showEditName">
                <v-text-field ref="editName" @change="onEditNameChange" placeholder="Set your name"></v-text-field>
              </v-list-item>
              <v-list-item v-for="(user, index) in $store.state.room.users" :key="index">
                {{ user.name }}
                <span v-if="user.isYou" class="is-you">You</span>
              </v-list-item>
            </v-card>
          </v-flex>
        </v-flex>
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
      sliderPosition: 0,
      volume: 100,
      showEditName: false
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

    this.$connect(`ws://${window.location.host}/api/room/${this.$route.params.roomId}`);
  },
  methods: {
    postTestVideo(v) {
      let videos = [
        "https://www.youtube.com/watch?v=cHpbcnCsl00",
        "https://www.youtube.com/watch?v=aI67KDJRnvQ"
      ];
      API.post(`/room/${this.$route.params.roomId}/queue`, {
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
      API.post(`/room/${this.$route.params.roomId}/queue`, {
        url: this.$refs.inputAddUrl.lazyValue
      });
    },
    openEditName() {
      this.showEditName = !this.showEditName;
      if (this.showEditName) {
        // Doesn't work
        this.$refs.editName.lazyValue = window.localStorage.getItem("username"); //this.$store.state.room.users.filter(u => u.isYou)[0].name;
      }
    },
    onEditNameChange() {
      window.localStorage.setItem("username", this.$refs.editName.lazyValue);
      this.$socket.sendObj({ action: "set-name", name: window.localStorage.getItem("username") });
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
.is-you {
  color: #fff;
  background-color: #aa00ff;
  border-radius: 5px;
  margin: 5px;
  padding: 0 5px;
  font-size: 10px;
}
</style>
