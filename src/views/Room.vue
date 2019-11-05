<template>
  <div>
    <v-container fluid class="room" v-if="!showJoinFailOverlay">
      <v-col class="d-flex flex-column">
        <input class="room-title" v-model="title" />
        <input class="room-description" placeholder="No description" v-model="description"/>
        <div class="room-connection">
          <div class="connection-indicator" :class="connectionStatus == 'Connected' ? 'open secondary' : 'primary'"></div>{{ connectionStatus }}
        </div>
      </v-col>
      <v-col>
        <v-row no-gutters class="video-container">
          <v-col cols="12" xl="7" md="8">
            <div class="iframe-container" :key="currentSource.service">
              <youtube v-if="currentSource.service == 'youtube'" fit-parent resize :video-id="currentSource.id" ref="youtube" :player-vars="{ controls: 0 }" @playing="onPlaybackChange(true)" @paused="onPlaybackChange(false)" @ready="onPlayerReady_Youtube"/>
            </div>
            <v-col class="video-controls">
              <vue-slider v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.currentSource.length" :tooltip-formatter="sliderTooltipFormatter"/>
              <v-row no-gutters align="center">
                <v-btn @click="togglePlayback()">
                  <v-icon v-if="$store.state.room.isPlaying">fas fa-pause</v-icon>
                  <v-icon v-else>fas fa-play</v-icon>
                </v-btn>
                <v-btn @click="skipVideo()">
                  <v-icon>fas fa-fast-forward</v-icon>
                </v-btn>
                <vue-slider v-model="volume" style="width: 150px; margin-left: 10px"/>
                <div style="margin-left: 20px" class="timestamp">
                  {{ timestampDisplay }}
                </div>
                <v-btn @click="toggleFullscreen()" style="margin-left: 10px">
                  <v-icon>fas fa-compress</v-icon>
                </v-btn>
              </v-row>
            </v-col>
          </v-col>
          <v-col cols="12" xl="5" md="4" class="chat-container">
            <div class="d-flex flex-column" style="height: 100%">
              <h4>Chat</h4>
              <div class="messages d-flex flex-column flex-grow-1 mt-2">
                <v-card class="msg d-flex mr-2 mb-2" v-for="(msg, index) in $store.state.room.chatMessages" :key="index">
                  <div class="from">{{ msg.from }}</div>
                  <div class="text">{{ msg.text }}</div>
                </v-card>
              </div>
              <div class="d-flex justify-end">
                <v-text-field placeholder="Type your message here..." @keydown="onChatMessageKeyDown" v-model="inputChatMsgText" autocomplete="off"/>
              </div>
            </div>
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col cols="8" md="8" sm="12">
            <v-tabs grow v-model="queueTab">
              <v-tab>
                Queue
                <span class="bubble">{{ $store.state.room.queue.length <= 99 ? $store.state.room.queue.length : "99+" }}</span>
              </v-tab>
              <v-tab>Add</v-tab>
            </v-tabs>
            <v-tabs-items v-model="queueTab" class="queue-tab-content">
              <v-tab-item>
                <div class="video-queue">
                  <VideoQueueItem v-for="(itemdata, index) in $store.state.room.queue" :key="index" :item="itemdata"/>
                </div>
              </v-tab-item>
              <v-tab-item>
                <div class="video-add">
                  <v-text-field placeholder="Video URL to add to queue" v-model="inputAddUrlText"/>
                  <v-btn v-if="!production" @click="postTestVideo(0)">Add test video 0</v-btn>
                  <v-btn v-if="!production" @click="postTestVideo(1)">Add test video 1</v-btn>
                  <VideoQueueItem v-for="(itemdata, index) in addPreview" :key="index" :item="itemdata" is-preview/>
                </div>
              </v-tab-item>
            </v-tabs-items>
          </v-col>
          <v-col col="4" md="4" sm="12">
            <div class="user-list">
              <v-card>
                <v-subheader>
                  Users
                  <v-btn icon x-small @click="openEditName"><v-icon>fas fa-cog</v-icon></v-btn>
                </v-subheader>
                <v-list-item v-if="showEditName">
                  <v-text-field @change="onEditNameChange" placeholder="Set your name" v-model="username"/>
                </v-list-item>
                <v-list-item v-for="(user, index) in $store.state.room.users" :key="index">
                  {{ user.name }}
                  <span v-if="user.isYou" class="is-you">You</span>
                </v-list-item>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-col>
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
import secondsToTimestamp from "@/timestamp.js";
import _ from "lodash";

export default {
  name: 'room',
  components: {
    VideoQueueItem,
  },
  data() {
    return {
      sliderPosition: 0,
      sliderTooltipFormatter: secondsToTimestamp,
      volume: 100,
      addPreview: [],

      username: "", // refers to the local user's username

      showEditName: false,
      queueTab: 0,
      isLoadingAddPreview: false,
      inputAddUrlText: "",
      inputChatMsgText: "",

      showJoinFailOverlay: false,
      joinFailReason: "",
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
    description: {
      get() {
        return this.room.description;
      },
      set(description) {
        let room = this.room;
        room.description = description;
        this.$store.commit('updateRoom', room);
        this.modifyRoom('description', description);
      },
    },
      playbackPosition() {
        return this.$store.state.room.playbackPosition;
      },
      playbackPercentage() {
        if (!this.$store.state.room.currentSource) {
          return 0;
        }
        if (this.$store.state.room.currentSource.length == 0) {
          return 0;
        }
        return this.$store.state.room.playbackPosition / this.$store.state.room.currentSource.length;
      },
      production() {
        return this.$store.state.production;
      },
      room() {
        return this.$store.state.room;  
      },
      timestampDisplay() {
        const position = secondsToTimestamp(this.$store.state.room.playbackPosition);
        const duration = secondsToTimestamp(this.$store.state.room.currentSource.length || 0);
        return position + " / " + duration;
    },
    title: {
      get() {
        return this.room.title != ""
          ? this.room.title
          : (this.room.isTemporary ? "Temporary Room" : this.room.name);
      },
      set(title) {
        let room = this.room;
        room.title = title;
        this.$store.commit('updateRoom', room);
        this.modifyRoom('title', title);
      },
    },
  },
  created() {
    if (window.localStorage.getItem("username") != null) {
      this.username = window.localStorage.getItem("username");
    }

    this.$events.on("onSync", () => {
      this.sliderPosition = this.$store.state.room.playbackPosition;
    });

    window.removeEventListener('keydown', this.onKeyDown);
    window.addEventListener('keydown', this.onKeyDown);

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
        "https://www.youtube.com/watch?v=aI67KDJRnvQ",
      ];
      API.post(`/room/${this.$route.params.roomId}/queue`, {
        url: videos[v],
      });
    },
    modifyRoom(prop, value) {
      API.patch(`/room/${this.$route.params.roomId}`, {
        [prop]: value,
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
        url: this.inputAddUrlText,
      });
    },
    openEditName() {
      if (window.localStorage.getItem("username") != null) {
        this.username = window.localStorage.getItem("username");
      }
      this.showEditName = !this.showEditName;
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
    requestAddPreview() {
      API.get(`/data/previewAdd?input=${encodeURIComponent(this.inputAddUrlText)}`).then(res => {
        this.isLoadingAddPreview = false;
        this.addPreview = res.data;
        console.log(`Got add preview with ${this.addPreview.length}`);
      }).catch(err => {
        this.isLoadingAddPreview = false;
        console.error("Failed to get add preview", err);
      });
    },
    requestAddPreviewDebounced: _.debounce(function() {
      // HACK: can't use an arrow function here because it will make `this` undefined
      this.requestAddPreview();
    }, 300),
    onEditNameChange() {
      this.$socket.sendObj({ action: "set-name", name: this.username });
      this.showEditName = false;
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
    onInputAddChange() {
      this.isLoadingAddPreview = true;
      if (_.trim(this.inputAddUrlText).length == 0) {
        this.addPreview = [];
        this.isLoadingAddPreview = false;
        return;
      }
      this.requestAddPreviewDebounced();
    },
    onPlayerReady_Youtube() {
      this.$refs.youtube.player.loadVideoById(this.$store.state.room.currentSource.id);
    },
    onKeyDown(e) {
      if (e.target.nodeName === "INPUT") {
        return;
      }

      if (e.code === "Space" || e.code === "k") {
        this.togglePlayback();
        e.preventDefault();
      }
      else if (e.code === "Home") {
        this.$socket.sendObj({ action: "seek", position: 0 });
        e.preventDefault();
      }
      else if (e.code === "End") {
        this.$socket.sendObj({ action: "skip" });
        e.preventDefault();
      }
      else if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "KeyJ" || e.code === "KeyL") {
        let seekIncrement = 5;
        if (e.ctrlKey || e.code === "KeyJ" || e.code === "KeyL") {
          seekIncrement = 10;
        }
        if (e.code === "ArrowLeft" || e.code === "KeyJ") {
          seekIncrement *= -1;
        }

        this.$socket.sendObj({
          action: "seek",
          position: _.clamp(this.$store.state.room.playbackPosition + seekIncrement, 0, this.$store.state.room.currentSource.length),
        });
        e.preventDefault();
      }
      else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        this.volume = _.clamp(this.volume + 5 * (e.code === "ArrowDown" ? -1 : 1), 0, 100);
        e.preventDefault();
      }
    },
    toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      else {
        document.documentElement.requestFullscreen();
      }
    },
    onChatMessageKeyDown(e) {
      if (e.keyCode === 13 && this.inputChatMsgText.length > 0) {
        this.$socket.sendObj({ action: "chat", text: this.inputChatMsgText });
        this.inputChatMsgText = "";
      }
    },
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
    username(newValue) {
      if (newValue != null) {
        window.localStorage.setItem("username", newValue);
      }
    },
    volume() {
      this.updateVolume();
    },
    async sliderPosition(newPosition) {
      if (Math.abs(newPosition - await this.$refs.youtube.player.getCurrentTime()) > 1) {
        this.$refs.youtube.player.seekTo(newPosition);
      }
    },
    inputAddUrlText() {
      // HACK: The @change event only triggers when the text field is defocused.
      // This ensures that onInputAddChange() runs everytime the text field's value changes.
      this.onInputAddChange();
    },
  },
  updated() {
    // scroll the messages to the bottom
    let msgsDiv = document.getElementsByClassName("messages")[0];
    if (msgsDiv.scrollTop >= msgsDiv.scrollHeight - msgsDiv.clientHeight - 100) {
      msgsDiv.scrollTop = msgsDiv.scrollHeight;
    }
  },
};
</script>

<style lang="scss" scoped>
.room-title {
  border: 1px solid transparent;
  font-size: 1.4rem;
  outline: none;
  width: 40%;
  &:focus {
    border-color: darken(rgba(255, 255, 255, 0.7), 25%);
  }
}
.room-description {
  border: 1px solid transparent;
  font-size: 0.9rem;
  height: auto;
  outline: none;
  width: 40%;
  &:focus {
    border-color: darken(rgba(255, 255, 255, 0.7), 25%);
  }
}
.room-connection {
  display: flex;
  align-items: center;
}
.connection-indicator {
  background: #ffb300;
  border-radius: 50%;
  height: 5px;
  margin-right: 7.5px;
  width: 5px;
  &.open {
    background: #42A5F5;
  }
}

.video-container {
  margin: 10px;
}
.video-queue, .video-add, .user-list {
  margin: 0 10px;
  min-height: 500px;
}
.queue-tab-content {
  background: transparent;
}
.is-you {
  color: #ffb300;
  border: 1px #ffb300 solid;
  border-radius: 10px;
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
  margin-left: 10px;
  background-color: #3f3838;
  border-radius: 50%;
  display: inline-block;

  font-weight: bold;
  color:#fff;
  text-align: center;
  line-height: 1.8;
}
.chat-container {
  padding: 5px 10px;

  h4 {
    border-bottom: 1px solid #666;
  }

  .messages {
    overflow-y: auto;

    // makes flex-grow work (for some reason)
    // the value is the height this element will take on md size screens and smaller
    height: 200px;

    // push the messages to the bottom of the container
    > .msg:first-child {
      margin-top: auto;
    }
  }

  .msg {
    background-color: #444;

    .from, .text {
      margin: 3px 5px;
    }

    .from {
      font-weight: bold;
    }
  }
}
</style>
