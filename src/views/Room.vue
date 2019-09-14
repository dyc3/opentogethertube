<template>
  <div>
    <v-container class="room" v-if="!showJoinFailOverlay">
      <v-layout column>
        <h1>{{ $store.state.room.title != "" ? $store.state.room.title : ($store.state.room.isTemporary ? "Temporary Room" : $store.state.room.name) }}</h1>
        <span>{{ connectionStatus }}</span>
      </v-layout>
      <v-layout column justify-center>
        <v-layout wrap class="video-container">
          <v-flex xl8>
            <div class="iframe-container" :key="currentSource.service">
              <youtube v-if="currentSource.service == 'youtube'" fitParent resize :video-id="currentSource.id" ref="youtube" :playerVars="{ controls: 0 }" @playing="onPlaybackChange(true)" @paused="onPlaybackChange(false)"></youtube>
            </div>
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
        <v-layout row justify-space-between>
          <v-flex column md8 sm12>
            <v-tabs grow v-model="queueTab">
              <v-tab>
                Queue
                <span class="bubble">{{$store.state.room.queue.length < 99? $store.state.room.queue.length : "99+"}}</span>
              </v-tab>
              <v-tab>Add</v-tab>
            </v-tabs>
            <div class="video-queue" v-if="queueTab === 0">
              <VideoQueueItem v-for="(itemdata, index) in $store.state.room.queue" :key="index" :item="itemdata"/>
            </div>
            <div class="video-add" v-if="queueTab === 1">
              <v-text-field placeholder="Video URL to add to queue" @change="onInputAddChange" v-model="inputAddUrlText"></v-text-field>
              <v-btn @click="addToQueue">Add</v-btn>
              <v-btn @click="postTestVideo(0)">Add test video 0</v-btn>
              <v-btn @click="postTestVideo(1)">Add test video 1</v-btn>

              <VideoQueueItem v-for="(itemdata, index) in addPreview" :key="index" :item="itemdata" isPreview/>
            </div>
          </v-flex>
          <v-flex column md4 sm12>
            <div class="user-list">
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
            </div>
          </v-flex>
        </v-layout>
      </v-layout>
    </v-container>
    <v-overlay :value="showJoinFailOverlay">
      <v-layout column>
        <h1>Failed to join room</h1>
        <span>{{ joinFailReason }}</span>
        <v-btn to="/rooms">Find Another Room</v-btn>
      </v-layout>
    </v-overlay>
  </div>
</template>

<script>
import { API } from "@/common-http.js";
import VideoQueueItem from "@/components/VideoQueueItem.vue";

export default {
  name: 'room',
  components: {
    VideoQueueItem
  },
  data() {
    return {
      sliderPosition: 0,
      volume: 100,
      addPreview: [],

      showEditName: false,
      queueTab: 0,
      isLoadingAddPreview: false,
      inputAddUrlText: "",

      showJoinFailOverlay: false,
      joinFailReason: "",

      totalItemsInQueue: 0
    };
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

    if (!this.$store.state.socket.isConnected) {
      // This check prevents the client from connecting multiple times,
      // caused by hot reloading in the dev environment.
      this.$connect(`${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${this.$route.params.roomId}`);
    }
  },
  methods: {
    postTestVideo(v) {
      let videos = [
        "https://www.youtube.com/watch?v=WC66l5tPIF4",
        "https://www.youtube.com/watch?v=aI67KDJRnvQ"
      ];
      API.post(`/room/${this.$route.params.roomId}/queue`, {
        url: videos[v]
      });
    },
    togglePlayback() {
      if (this.$store.state.room.isPlaying) {
        this.$socket.sendObj({ action: "pause" });
      }
      else {
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
        url: this.inputAddUrlText
      });
      this.totalItemsInQueue += 1;
    },
    openEditName() {
      this.showEditName = !this.showEditName;
      if (this.showEditName) {
        // Doesn't work
        this.$refs.editName.lazyValue = window.localStorage.getItem("username"); //this.$store.state.room.users.filter(u => u.isYou)[0].name;
      }
    },
    play() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.player.playVideo();
      }
    },
    pause() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.player.pauseVideo();
      }
    },
    updateVolume() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.player.setVolume(this.volume);
      }
    },
    onEditNameChange() {
      window.localStorage.setItem("username", this.$refs.editName.lazyValue);
      this.$socket.sendObj({ action: "set-name", name: window.localStorage.getItem("username") });
    },
    onPlaybackChange(changeTo) {
      this.updateVolume();
      if (changeTo == this.$store.state.room.isPlaying) {
        return;
      }

      if (this.$store.state.room.isPlaying) {
        this.play();
      }
      else {
        this.pause();
      }
    },
    onInputAddChange(value) {
      // TODO: debounce
      this.isLoadingAddPreview = true;
      API.get(`/data/previewAdd?input=${encodeURIComponent(value)}`).then(res => {
        this.isLoadingAddPreview = false;
        this.addPreview = res.data;
        console.log(`Got add preview with ${this.addPreview.length}`);
      }).catch(err => {
        this.isLoadingAddPreview = false;
        console.error("Failed to get add preview", err);
      });
    }
  },
  mounted() {
    this.$events.on("playVideo", () => {
      this.play();
    });
    this.$events.on("pauseVideo", () => {
      this.pause();
    });
    this.$events.on("roomJoinFailure", eventData => {
      this.showJoinFailOverlay = true;
      this.joinFailReason = eventData.reason;
    });
  },
  watch: {
    volume() {
      this.updateVolume();
    },
    async sliderPosition(newPosition) {
      if (Math.abs(newPosition - await this.$refs.youtube.player.getCurrentTime()) > 1) {
        this.$refs.youtube.player.seekTo(newPosition);
      }
    },
  }
};
</script>

<style lang="scss" scoped>
.video-container {
  // width: 853px;
  margin: 10px;
}
.video-queue, .video-add, .user-list {
  margin: 0 10px;
  min-height: 500px;
}
.is-you {
  color: #fff;
  background-color: #aa00ff;
  border-radius: 5px;
  margin: 5px;
  padding: 0 5px;
  font-size: 10px;
}
.iframe-container {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
  max-width: 100%;
}
.iframe-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.bubble{
  height: 25px;
  width: 25px;
  left: 10px;
  background-color: #3f3838;
  border-radius: 50%;
  display: inline-block;

  font-weight: bold;
  color:#fff;
  text-align: center;
  line-height: 1.8;
}
</style>
