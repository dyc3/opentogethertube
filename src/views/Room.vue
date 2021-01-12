<template>
  <div>
    <v-container fluid :class="{ room: true, fullscreen: $store.state.fullscreen }" v-if="!showJoinFailOverlay">
      <v-col v-if="!$store.state.fullscreen">
        <h1>{{ $store.state.room.title != "" ? $store.state.room.title : ($store.state.room.isTemporary ? "Temporary Room" : $store.state.room.name) }}</h1>
        <span id="connectStatus">{{ connectionStatus }}</span>
      </v-col>
      <v-col :style="{ padding: ($store.state.fullscreen ? 0 : 'inherit') }">
        <v-row no-gutters class="video-container">
          <div class="video-subcontainer" cols="12" :xl="$store.state.fullscreen ? 9 : 7" md="8" :style="{ padding: ($store.state.fullscreen ? 0 : 'inherit') }">
            <v-responsive :aspect-ratio="16/9" class="player-container" :key="currentSource.service">
              <OmniPlayer
                ref="player"
                :source="currentSource"
                :class="{ player: true, 'no-video': !currentSource.service }"
                @playing="onPlaybackChange(true)"
                @paused="onPlaybackChange(false)"
                @ready="onPlayerReady"
                @buffering="onVideoBuffer"
                @error="onVideoError"
                @buffer-spans="spans => $store.commit('PLAYBACK_BUFFER_SPANS', spans)"
              />
            </v-responsive>
            <v-col class="video-controls">
              <vue-slider id="videoSlider" v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.currentSource.length" :tooltip-formatter="sliderTooltipFormatter" :disabled="currentSource.length == null"/>
              <v-row no-gutters align="center">
                <v-tooltip bottom>
                  <template v-slot:activator="{ on, attrs }">
                    <v-btn @click="seekDelta(-10)" v-bind="attrs" v-on="on">
                      <v-icon>fas fa-angle-left</v-icon>
                    </v-btn>
                  </template>
                  <span>Rewind 10s</span>
                </v-tooltip>
                <v-btn @click="togglePlayback()">
                  <v-icon v-if="$store.state.room.isPlaying">fas fa-pause</v-icon>
                  <v-icon v-else>fas fa-play</v-icon>
                </v-btn>
                <v-tooltip bottom>
                  <template v-slot:activator="{ on, attrs }">
                    <v-btn @click="seekDelta(10)" v-bind="attrs" v-on="on">
                      <v-icon>fas fa-angle-right</v-icon>
                    </v-btn>
                  </template>
                  <span>Skip 10s</span>
                </v-tooltip>
                <v-btn @click="roomSkip()">
                  <v-icon>fas fa-fast-forward</v-icon>
                </v-btn>
                <vue-slider v-model="volume" style="width: 150px; margin-left: 10px; margin-right: 20px"/>
                <div>
                  <v-text-field class="textseek" v-if="textSeek.active" v-model="textSeek.value" ref="textseek" solo hide-details @keydown="textSeekOnKeyDown" />
                  <span v-else class="timestamp" @click="activateTextSeek">
                    {{ timestampDisplay }}
                  </span>
                  <span>/</span>
                  <span class="video-length">
                    {{ lengthDisplay }}
                  </span>
                </div>
                <v-btn @click="toggleFullscreen()" style="margin-left: 10px">
                  <v-icon>fas fa-compress</v-icon>
                </v-btn>
                <v-btn v-if="!production" @click="roomKickMe()" :disabled="!this.$store.state.socket.isConnected">Kick me</v-btn>
              </v-row>
            </v-col>
          </div>
          <div cols="12" :xl="$store.state.fullscreen ? 3 : 5" md="4" class="chat-container">
            <Chat class="chat" />
          </div>
        </v-row>
        <v-row no-gutters>
          <v-col cols="12" md="8" sm="12">
            <v-tabs grow v-model="queueTab" @change="onTabChange">
              <v-tab>
                Queue
                <span class="bubble">{{ $store.state.room.queue.length <= 99 ? $store.state.room.queue.length : "99+" }}</span>
              </v-tab>
              <v-tab>Add</v-tab>
              <v-tab>Settings</v-tab>
            </v-tabs>
            <v-tabs-items v-model="queueTab" class="queue-tab-content">
              <v-tab-item>
                <div class="video-queue">
                  <draggable v-model="$store.state.room.queue" @end="onQueueDragDrop" handle=".drag-handle">
                    <VideoQueueItem v-for="(itemdata, index) in $store.state.room.queue" :key="index" :item="itemdata"/>
                  </draggable>
                </div>
              </v-tab-item>
              <v-tab-item>
                <AddPreview />
              </v-tab-item>
              <v-tab-item>
                <div class="room-settings">
                  <v-form @submit="submitRoomSettings">
                    <v-text-field label="Title" v-model="inputRoomSettings.title" :loading="isLoadingRoomSettings" />
                    <v-text-field label="Description" v-model="inputRoomSettings.description" :loading="isLoadingRoomSettings" />
                    <v-select label="Visibility" :items="[{ text: 'public' }, { text: 'unlisted' }]" v-model="inputRoomSettings.visibility" :loading="isLoadingRoomSettings" />
                    <v-select label="Queue Mode" :items="[{ text: 'manual' }, { text: 'vote' }]" v-model="inputRoomSettings.queueMode" :loading="isLoadingRoomSettings" />
                    <v-btn @click="submitRoomSettings" role="submit" :loading="isLoadingRoomSettings">Save</v-btn>
                  </v-form>
                  <v-btn v-if="!$store.state.room.isTemporary && $store.state.user && !$store.state.room.hasOwner" role="submit" @click="claimOwnership">Claim Room</v-btn>
                </div>
              </v-tab-item>
            </v-tabs-items>
          </v-col>
          <v-col col="4" md="4" sm="12" class="user-invite-container">
            <div v-if="!production" class="debug-container">
              <v-card>
                <v-subheader>
                  Debug
                </v-subheader>
                <v-list-item>
                  Player status: {{ this.$store.state.playerStatus }}
                </v-list-item>
                <v-list-item>
                  Buffered: {{ Math.round(this.$store.state.playerBufferPercent * 10000) / 100 }}%
                </v-list-item>
                <v-list-item v-if="this.$store.state.playerBufferSpans && this.$store.state.playerBufferSpans.length > 0">
                  Buffered spans:
                  {{ this.$store.state.playerBufferSpans.length }}
                  {{
                    Array.from({ length: this.$store.state.playerBufferSpans.length }, (v,k) => k++)
                      .map(i => `${i}: [${$store.state.playerBufferSpans.start(i)} => ${$store.state.playerBufferSpans.end(i)}]`)
                      .join(" ")
                  }}
                </v-list-item>
              </v-card>
            </div>
            <div class="user-list" v-if="$store.state.room.users">
              <v-card>
                <v-subheader>
                  Users
                  <v-btn icon x-small @click="openEditName"><v-icon>fas fa-cog</v-icon></v-btn>
                </v-subheader>
                <v-list-item v-if="showEditName">
                  <v-text-field @change="onEditNameChange" placeholder="Set your name" v-model="username" :loading="setUsernameLoading" :error-messages="setUsernameFailureText"/>
                </v-list-item>
                <v-list-item v-for="(user, index) in $store.state.room.users" :key="index" :class="user.isLoggedIn ? 'user registered' : 'user'">
                  <span class="name">{{ user.name }}</span>
                  <span v-if="user.isYou" class="is-you">You</span>
                  <v-icon class="player-status" v-if="user.status === 'buffering'">fas fa-spinner</v-icon>
                  <v-icon class="player-status" v-else-if="user.status === 'ready'">fas fa-check</v-icon>
                  <v-icon class="player-status" v-else-if="user.status === 'error'">fas fa-exclamation</v-icon>
                </v-list-item>
                <v-list-item class="nobody-here" v-if="$store.state.room.users.length === 1">
                  There seems to be nobody else here. Invite some friends!
                </v-list-item>
              </v-card>
            </div>
            <div class="share-invite">
              <v-card>
                <v-subheader>
                  Share Invite
                </v-subheader>
                <v-card-text>
                  Copy this link and share it with your friends!
                  <v-text-field outlined ref="inviteLinkText" :value="inviteLink" append-outer-icon="fa-clipboard" :success-messages="copyInviteLinkSuccessText" @focus="onFocusHighlightText" @click:append-outer="copyInviteLink" />
                </v-card-text>
              </v-card>
            </div>
          </v-col>
        </v-row>
      </v-col>
    </v-container>
    <v-footer>
      <v-container pa-0>
        <v-row no-gutters align="center" justify="center">
          <router-link to="/privacypolicy">Privacy Policy</router-link>
        </v-row>
      </v-container>
    </v-footer>
    <v-overlay :value="showJoinFailOverlay">
      <v-layout column>
        <h1>Failed to join room</h1>
        <span>{{ joinFailReason }}</span>
        <v-btn to="/rooms">Find Another Room</v-btn>
      </v-layout>
    </v-overlay>
    <v-snackbar v-if="$store.state.room.events.length > 0" :key="$store.state.room.events.length" v-model="$store.state.room.events[$store.state.room.events.length - 1].isVisible" :timeout="$store.state.room.events[$store.state.room.events.length - 1].timeout">
      {{ snackbarText }}
      <v-btn @click="undoEvent($store.state.room.events[$store.state.room.events.length - 1], $store.state.room.events.length - 1)" v-if="$store.state.room.events[$store.state.room.events.length - 1].isUndoable">Undo</v-btn>
    </v-snackbar>
  </div>
</template>

<script>
import { API } from "@/common-http.js";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import AddPreview from "@/components/AddPreview.vue";
import { secondsToTimestamp, calculateCurrentPosition, timestampToSeconds } from "@/timestamp.js";
import _ from "lodash";
import draggable from 'vuedraggable';
import VueSlider from 'vue-slider-component';
import OmniPlayer from "@/components/OmniPlayer.vue";
import Chat from "@/components/Chat.vue";

export default {
  name: 'room',
  components: {
    draggable,
    VideoQueueItem,
    VueSlider,
    OmniPlayer,
    Chat,
    AddPreview,
  },
  data() {
    return {
      truePosition: 0,
      sliderPosition: 0,
      sliderTooltipFormatter: secondsToTimestamp,
      volume: 100,

      username: "", // refers to the local user's username

      showEditName: false,
      queueTab: 0,
      isLoadingRoomSettings: false,
      inputRoomSettings: {
        title: "",
        description: "",
        visibility: "",
        queueMode: "",
      },
      setUsernameLoading: false,
      setUsernameFailureText: "",

      showJoinFailOverlay: false,
      joinFailReason: "",
      snackbarActive: false,
      snackbarText: "",

      i_timestampUpdater: null,

      copyInviteLinkSuccessText: "",

      textSeek: {
        active: false,
        value: "",
      },
    };
  },
  computed: {
    connectionStatus() {
      return this.$store.state.socket.isConnected ? "Connected" : "Connecting...";
    },
    currentSource() {
      return this.$store.state.room.currentSource;
    },
    playbackPosition() {
      return this.$store.state.room.playbackPosition;
    },
    /**
     * This is used so we can test for development/production only behavior in unit tests.
     * Do not change.
     */
    production() {
      return this.$store.state.production;
    },
    inviteLink() {
      return window.location.href.split('?')[0].toLowerCase();
    },
    timestampDisplay() {
      return secondsToTimestamp(this.truePosition);
    },
    lengthDisplay() {
      return secondsToTimestamp(this.$store.state.room.currentSource.length || 0);
    },
  },
  async created() {
    this.$events.on("onRoomEvent", event => {
      if (event.eventType === "play") {
        this.snackbarText = `${event.userName} played the video`;
      }
      else if (event.eventType === "pause") {
        this.snackbarText = `${event.userName} paused the video`;
      }
      else if (event.eventType === "skip") {
        this.snackbarText = `${event.userName} skipped ${event.parameters.video.title}`;
      }
      else if (event.eventType === "seek") {
        this.snackbarText = `${event.userName} seeked to ${secondsToTimestamp(event.parameters.position)}`;
      }
      else if (event.eventType === "joinRoom") {
        this.snackbarText = `${event.userName} joined the room`;
      }
      else if (event.eventType === "leaveRoom") {
        this.snackbarText = `${event.userName} left the room`;
      }
      else if (event.eventType === "addToQueue") {
        if (event.parameters.count) {
          this.snackbarText = `${event.userName} added ${event.parameters.count} videos`;
        }
        else {
          this.snackbarText = `${event.userName} added ${event.parameters.video.title}`;
        }
      }
      else if (event.eventType === "removeFromQueue") {
        this.snackbarText = `${event.userName} removed ${event.parameters.video.title}`;
      }
      else {
        this.snackbarText = `${event.userName} triggered event ${event.eventType}`;
      }
      this.snackbarActive = true;
    });

    this.$events.on("onRoomCreated", () => {
      if (this.$store.state.socket.isConnected) {
        this.$disconnect();
      }
      setTimeout(() => {
        if (!this.$store.state.socket.isConnected) {
          this.$connect(`${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${this.$route.params.roomId}`);
        }
      }, 100);
    });

    this.$events.on("onChatLinkClick", link => {
      this.queueTab = 1;
    });

    window.removeEventListener('keydown', this.onKeyDown);
    window.addEventListener('keydown', this.onKeyDown);

    if (!this.$store.state.socket.isConnected) {
      // This check prevents the client from connecting multiple times,
      // caused by hot reloading in the dev environment.
      this.$connect(`${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${this.$route.params.roomId}`);
    }

    this.i_timestampUpdater = setInterval(this.timestampUpdate, 250);

    this.$events.on("onSync", this.rewriteUrlToRoomName);
  },
  destroyed() {
    clearInterval(this.i_timestampUpdater);
    this.$disconnect();
    this.$events.remove("onSync", this.rewriteUrlToRoomName);
  },
  methods: {
    /* ROOM API */

    roomPlay() {
      this.$socket.sendObj({ action: "play" });
    },
    roomPause() {
      this.$socket.sendObj({ action: "pause" });
    },
    togglePlayback() {
      if (this.$store.state.room.isPlaying) {
        this.roomPause();
      }
      else {
        this.roomPlay();
      }
    },
    roomSkip() {
      this.$socket.sendObj({ action: "skip" });
    },
    roomSeek(position) {
      this.$socket.sendObj({ action: "seek", position });
    },
    /**
     * Move the video from `fromIdx` to `toIdx` in the queue.
     * @param {Number} fromIdx
     * @param {Number} toIdx
     * */
    roomQueueMove(fromIdx, toIdx) {
      this.$socket.sendObj({
        action: "queue-move",
        currentIdx: fromIdx,
        targetIdx: toIdx,
      });
    },
    undoEvent(event, idx) {
      this.$socket.sendObj({
        action: "undo",
        event,
      });
      this.$store.state.room.events.splice(idx, 1);
    },
    roomKickMe() {
      this.$socket.sendObj({
        action: "kickme",
      });
    },
    async submitRoomSettings() {
      this.isLoadingRoomSettings = true;
      await API.patch(`/room/${this.$route.params.roomId}`, this.inputRoomSettings);
      this.isLoadingRoomSettings = false;
    },
    async claimOwnership() {
      this.isLoadingRoomSettings = true;
      try {
        await API.patch(`/room/${this.$route.params.roomId}`, {
          claim: true,
        });
      }
      catch (error) {
        console.log(error);
      }
      this.isLoadingRoomSettings = false;
    },

    /* OTHER */

    /** Clock that calculates what the true playback position should be. */
    timestampUpdate() {
      this.truePosition = this.$store.state.room.isPlaying ? calculateCurrentPosition(this.$store.state.room.playbackStartTime, new Date(), this.$store.state.room.playbackPosition) : this.$store.state.room.playbackPosition;
      this.sliderPosition = _.clamp(this.truePosition, 0, this.$store.state.room.currentSource.length);
    },
    sliderChange() {
      this.roomSeek(this.sliderPosition);
    },
    openEditName() {
      this.username = this.$store.state.user ? this.$store.state.user.username : this.$store.state.username;
      this.showEditName = !this.showEditName;
    },
    updateVolume() {
      this.$refs.player.setVolume(this.volume);
    },
    onEditNameChange() {
      this.setUsernameLoading = true;
      API.post("/user", { username: this.username }).then(() => {
        this.showEditName = false;
        this.setUsernameLoading = false;
        this.setUsernameFailureText = "";
      }).catch(err => {
        this.setUsernameLoading = false;
        this.setUsernameFailureText = err.response ? err.response.data.error.message : err.message;
      });
    },
    onPlaybackChange(changeTo) {
      console.log(`onPlaybackChange: ${changeTo}`);
      if (this.currentSource.service === "youtube" || this.currentSource.service === "dailymotion") {
        this.$store.commit("PLAYBACK_STATUS", "ready");
      }
      this.updateVolume();
      if (changeTo === this.$store.state.room.isPlaying) {
        return;
      }

      if (this.$store.state.room.isPlaying) {
        this.$refs.player.play();
      }
      else {
        this.$refs.player.pause();
      }
    },
    onFocusHighlightText(e) {
      e.target.select();
    },
    onPlayerReady() {
      this.$store.commit("PLAYBACK_STATUS", "ready");

      if (this.currentSource.service === "vimeo") {
        this.onPlayerReady_Vimeo();
      }
    },
    onPlayerReady_Vimeo() {
      if (this.$store.state.room.isPlaying) {
        this.$refs.player.play();
      }
      else {
        this.$refs.player.pause();
      }
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
      else if (e.code === "KeyF") {
        this.toggleFullscreen();
      }
      else if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "KeyJ" || e.code === "KeyL") {
        let seekIncrement = 5;
        if (e.ctrlKey || e.code === "KeyJ" || e.code === "KeyL") {
          seekIncrement = 10;
        }
        if (e.code === "ArrowLeft" || e.code === "KeyJ") {
          seekIncrement *= -1;
        }

        this.seekDelta(seekIncrement);
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
    onQueueDragDrop(e) {
      this.roomQueueMove(e.oldIndex, e.newIndex);
    },
    onTabChange() {
      if (this.queueTab === 2) {
        // FIXME: we have to make an API request becuase visibility is not sent in sync messages.
        this.isLoadingRoomSettings = true;
        API.get(`/room/${this.$route.params.roomId}`).then(res => {
          this.isLoadingRoomSettings = false;
          this.inputRoomSettings.title = res.data.title;
          this.inputRoomSettings.description = res.data.description;
          this.inputRoomSettings.visibility = res.data.visibility;
          this.inputRoomSettings.queueMode = res.data.queueMode;
        });
      }
    },
    onVideoBuffer(percent) {
      this.$store.commit("PLAYBACK_STATUS", "buffering");
      this.$store.commit("PLAYBACK_BUFFER", percent);
    },
    onVideoError() {
      this.$store.commit("PLAYBACK_STATUS", "error");
    },
    hideVideoControls: _.debounce(() => {
      let controlsDiv = document.getElementsByClassName("video-controls");
      if (controlsDiv.length) {
        controlsDiv = controlsDiv[0];
        controlsDiv.classList.add("hide");
      }
    }, 3000),
    copyInviteLink() {
      let textfield = this.$refs.inviteLinkText.$el.querySelector('input');
      textfield.select();
      document.execCommand("copy");
      this.copyInviteLinkSuccessText = "Copied!";
      setTimeout(() => {
        this.copyInviteLinkSuccessText = "";
        textfield.blur();
      }, 3000);
    },
    rewriteUrlToRoomName() {
      if (this.$route.params.roomId !== this.$store.state.room.name) {
        this.$router.replace({ name: "room", params: { roomId: this.$store.state.room.name } });
      }
    },
    seekDelta(delta) {
      this.roomSeek(_.clamp(this.truePosition + delta, 0, this.$store.state.room.currentSource.length));
    },
    activateTextSeek() {
      this.textSeek.active = true;
      this.textSeek.value = this.timestampDisplay;
      this.$nextTick(() => {
        this.$refs.textseek.focus();
        this.$refs.textseek.$el.getElementsByTagName('INPUT')[0].addEventListener("focusout", () => {
          this.textSeek.active = false;
        });
      });
    },
    textSeekOnKeyDown(e) {
      if (e.code === "Escape") {
        this.textSeek.active = false;
      }
      else if (e.keyCode === 13) {
        this.textSeek.active = false;
        try {
          let seconds = timestampToSeconds(this.textSeek.value);
          this.roomSeek(seconds);
        }
        catch {
          console.log("Invalid timestamp, ignoring");
        }
      }
    },
  },
  mounted() {
    this.$events.on("playVideo", () => {
      this.$refs.player.play();
    });
    this.$events.on("pauseVideo", () => {
      this.$refs.player.pause();
    });
    this.$events.on("roomJoinFailure", eventData => {
      this.showJoinFailOverlay = true;
      this.joinFailReason = eventData.reason;
    });

    document.onmousemove = () => {
      let controlsDiv = document.getElementsByClassName("video-controls");
      if (controlsDiv.length) {
        controlsDiv = controlsDiv[0];
        controlsDiv.classList.remove("hide");
      }
      this.hideVideoControls();
    };

    if (this.$store.state.quickAdd.length > 0) {
      for (let video of this.$store.state.quickAdd) {
        API.post(`/room/${this.$route.params.roomId}/queue`, _.pick(video, [
          "service",
          "id",
          "url",
        ]));
      }
    }
  },
  watch: {
    volume() {
      this.updateVolume();
    },
    async truePosition(newPosition) {
      let currentTime = await this.$refs.player.getPosition();

      if (Math.abs(newPosition - currentTime) > 1) {
        this.$refs.player.setPosition(newPosition);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.video-container {
  margin: 10px;

  .player {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .no-video {
    height: 100%;
    color: #696969;
    border: 1px solid #666;
    border-radius: 3px;
  }

  .video-subcontainer {
    width: calc(100% / 12 * 8);
  }

  .chat-container {
    width: calc(100% / 12 * 4);

    .chat {
      min-height: 400px;
      height: 100%;
    }
  }

  @media (max-width: $md-max) {
    .video-subcontainer, .chat-container {
      width: 100%;
    }

    margin: 0;
  }

  @media (min-width: $xl-min) {
    .video-subcontainer {
      width: calc(100% / 12 * 7);
    }

    .chat-container {
      width: calc(100% / 12 * 5);
    }
  }
}
.video-queue, .video-add {
  margin: 0 10px;
  min-height: 500px;
}
.user-invite-container {
  padding: 0 10px;
  min-height: 500px;

  > * {
    margin-bottom: 10px;
  }
}
.nobody-here {
  font-style: italic;
  opacity: 0.5;
  font-size: 0.9em;
}
.queue-tab-content {
  background: transparent !important;
}
.is-you {
  color: $brand-color;
  border: 1px $brand-color solid;
  border-radius: 10px;
  margin: 5px;
  padding: 0 5px;
  font-size: 10px;
}
.player-status {
  margin: 0 5px;
  font-size: 12px;
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
}

.flip-list-move {
  transition: transform 0.5s;
}
.no-move {
  transition: transform 0s;
}

.fullscreen {
  padding: 0;

  .video-container {
    margin: 0;
  }

  .video-subcontainer {
    width: calc(100% / 12 * 9);
  }

  .chat-container {
    width: calc(100% / 12 * 3);
  }

  .player-container {
    height: 100vh;

    .player {
      border: none;
      border-right: 1px solid #666;
    }
  }

  .video-controls {
    position: sticky;
    bottom: 0;
    background: $background-color;
    transition: opacity 0.2s;

    &.hide {
      opacity: 0;
    }
  }

  @media only screen and (max-aspect-ratio: 16/9) {
    .video-subcontainer {
      width: 100%;
    }

    .chat-container {
      display: none;
    }
  }
}
.user {
  .name {
    opacity: 0.5;
    font-style: italic;
  }

  &.registered {
    .name {
      opacity: 1;
      font-style: normal;
    }
  }
}

.room {
  @media (max-width: $md-max) {
    padding: 0;
  }
}

.textseek {
  display: inline-flex;
  width: 90px;
}
</style>
