<template>
  <div>
    <v-container fluid :class="{ room: true, fullscreen: $store.state.fullscreen }" v-if="!showJoinFailOverlay">
      <v-col v-if="!$store.state.fullscreen">
        <h1 class="room-title">{{ $store.state.room.title != "" ? $store.state.room.title : ($store.state.room.isTemporary ? "Temporary Room" : $store.state.room.name) }}</h1>
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
                @apiready="onPlayerApiReady"
                @playing="onPlaybackChange(true)"
                @paused="onPlaybackChange(false)"
                @ready="onPlayerReady"
                @buffering="onVideoBuffer"
                @error="onVideoError"
                @buffer-spans="spans => $store.commit('PLAYBACK_BUFFER_SPANS', spans)"
              />
              <div id="mouse-event-swallower" class="hide"></div>
              <v-col class="video-controls">
                <vue-slider
                  id="videoSlider"
                  :interval="0.1"
                  :lazy="true"
                  v-model="sliderPosition"
                  :max="$store.state.room.currentSource.length"
                  :tooltip-formatter="sliderTooltipFormatter"
                  :disabled="currentSource.length == null || !granted('playback.seek')"
                  :process="getSliderProcesses"
                  @change="sliderChange"
                  :drag-on-click="true"
                  tooltip="hover"
                />
                <v-row no-gutters align="center">
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on, attrs }">
                      <v-btn @click="seekDelta(-10)" v-bind="attrs" v-on="on" :disabled="!granted('playback.seek')">
                        <v-icon>fas fa-angle-left</v-icon>
                      </v-btn>
                    </template>
                    <span>Rewind 10s</span>
                  </v-tooltip>
                  <v-btn @click="togglePlayback()" :disabled="!granted('playback.play-pause')">
                    <v-icon v-if="$store.state.room.isPlaying">fas fa-pause</v-icon>
                    <v-icon v-else>fas fa-play</v-icon>
                  </v-btn>
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on, attrs }">
                      <v-btn @click="seekDelta(10)" v-bind="attrs" v-on="on" :disabled="!granted('playback.seek')">
                        <v-icon>fas fa-angle-right</v-icon>
                      </v-btn>
                    </template>
                    <span>Skip 10s</span>
                  </v-tooltip>
                  <v-btn @click="api.skip()" :disabled="!granted('playback.skip')">
                    <v-icon>fas fa-fast-forward</v-icon>
                  </v-btn>
                  <vue-slider
                    v-model="volume"
                    style="width: 150px; margin-left: 10px; margin-right: 20px"
                    :process="(dotsPos) => [[0, dotsPos[0], { backgroundColor:'#ffb300' }]]"
                    :drag-on-click="true"
                  />
                  <div>
                    <v-text-field class="textseek" v-if="textSeek.active" v-model="textSeek.value" ref="textseek" solo hide-details dense @keydown="textSeekOnKeyDown" />
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
                  <v-btn v-if="debugMode" @click="api.kickMe()" :disabled="!isConnected">Kick me</v-btn>
                </v-row>
              </v-col>
            </v-responsive>
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
                <VideoQueue @switchtab="switchToAddTab" />
              </v-tab-item>
              <v-tab-item>
                <AddPreview />
              </v-tab-item>
              <v-tab-item>
                <RoomSettings
                  ref="settings"
                />
                  <!-- v-if="queueTab === 2 /* HACK: force the component to mount when the tab becomes active, and destroy it when the tab is not active. */" -->
              </v-tab-item>
            </v-tabs-items>
          </v-col>
          <v-col col="4" md="4" sm="12" class="user-invite-container">
            <div v-if="debugMode" class="debug-container">
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
                <v-list-item>
                  <span>Is Mobile: {{ this.isMobile }}</span>
                </v-list-item>
                <v-list-item>
                  <span>Device Orientation: {{ this.orientation }}</span>
                </v-list-item>
                <v-list-item>
                  <span>Video controls: timeoutId: {{ this.videoControlsHideTimeout }} visible: {{ this.debugLastControlsVisibility }}</span>
                </v-list-item>
              </v-card>
            </div>
            <UserList :users="$store.state.room.users" v-if="$store.state.room.users" />
            <ShareInvite />
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
        <span>{{ $store.state.joinFailureReason }}</span>
        <v-btn to="/rooms">Find Another Room</v-btn>
      </v-layout>
    </v-overlay>
  </div>
</template>

<script>
import { API } from "@/common-http.js";
import AddPreview from "@/components/AddPreview.vue";
import { secondsToTimestamp, calculateCurrentPosition, timestampToSeconds } from "@/util/timestamp";
import _ from "lodash";
import VueSlider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css';
import OmniPlayer from "@/components/OmniPlayer.vue";
import Chat from "@/components/Chat.vue";
import PermissionsMixin from "@/mixins/permissions";
import UserList from "@/components/UserList.vue";
import connection from "@/util/connection";
import api from "@/util/api";
import { PlayerStatus, QueueMode } from 'common/models/types';
import VideoQueue from "@/components/VideoQueue.vue";
import goTo from 'vuetify/lib/services/goto';
import RoomSettings from "@/components/RoomSettings.vue";
import ShareInvite from "@/components/ShareInvite.vue";

export default {
  name: 'room',
  components: {
    VideoQueue,
    VueSlider,
    OmniPlayer,
    Chat,
    AddPreview,
    UserList,
    RoomSettings,
    ShareInvite,
  },
  mixins: [PermissionsMixin],
  data() {
    return {
      debugMode: !this.production,
      debugLastControlsVisibility: true,

      truePosition: 0,
      sliderPosition: 0,
      sliderTooltipFormatter: secondsToTimestamp,
      seekPreview: null,
      volume: 100,

      queueTab: 0,

      snackbarActive: false,
      snackbarText: "",

      i_timestampUpdater: null,

      textSeek: {
        active: false,
        value: "",
      },

      orientation: screen.orientation.type,
      videoControlsHideTimeout: null,

      api,
      QueueMode,
    };
  },
  computed: {
    isConnected() {
      return this.$store.state.$connection.isConnected;
    },
    connectionStatus() {
      return this.$store.state.$connection.isConnected ? "Connected" : "Connecting...";
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
    timestampDisplay() {
      return secondsToTimestamp(this.truePosition);
    },
    lengthDisplay() {
      return secondsToTimestamp(this.$store.state.room.currentSource.length || 0);
    },
    showJoinFailOverlay() {
      return !!this.$store.state.joinFailureReason;
    },
    isMobile() {
      return window.matchMedia("only screen and (max-width: 760px)").matches;
    },
  },
  async created() {
    this.$store.subscribeAction((action) => {
      if (action.type === "sync") {
        this.rewriteUrlToRoomName();
      }
    });
    this.$events.on("onRoomCreated", this.onRoomCreated);
    this.$events.on("onChatLinkClick", this.switchToAddTab);

    window.removeEventListener('keydown', this.onKeyDown);
    window.addEventListener('keydown', this.onKeyDown);

    if (!this.$store.state.$connection.isConnected) {
      connection.connect(this.$route.params.roomId);
    }

    this.i_timestampUpdater = setInterval(this.timestampUpdate, 250);

    screen.orientation.addEventListener('change', this.onScreenOrientationChange);
  },
  destroyed() {
    clearInterval(this.i_timestampUpdater);
    connection.disconnect();
    this.$events.remove("onRoomCreated", this.onRoomCreated);
    this.$events.remove("onChatLinkClick", this.switchToAddTab);
    screen.orientation.removeEventListener('change', this.onScreenOrientationChange);
  },
  methods: {
    /* ROOM API */

    // TODO: maybe move to util/api?
    /** Send a message to play or pause the video, depending on the current state. */
    togglePlayback() {
      if (this.$store.state.room.isPlaying) {
        api.pause();
      }
      else {
        api.play();
      }
    },

    /* OTHER */

    /** Clock that calculates what the true playback position should be. */
    timestampUpdate() {
      this.truePosition = this.$store.state.room.isPlaying ? calculateCurrentPosition(this.$store.state.room.playbackStartTime, new Date(), this.$store.state.room.playbackPosition) : this.$store.state.room.playbackPosition;
      this.sliderPosition = _.clamp(this.truePosition, 0, this.$store.state.room.currentSource.length);
    },
    sliderChange() {
      if (!this.sliderDragging) {
        api.seek(this.sliderPosition);
      }
    },

    updateVolume() {
      this.$refs.player.setVolume(this.volume);
    },
    onPlayerApiReady() {
      console.log('internal player API is now ready');
    },
    onPlaybackChange(changeTo) {
      console.log(`onPlaybackChange: ${changeTo}`);
      if (this.currentSource.service === "youtube" || this.currentSource.service === "dailymotion") {
        this.$store.commit("PLAYBACK_STATUS", PlayerStatus.ready);
      }
      if (!changeTo) {
        this.setVideoControlsVisibility(true);
      }
      else {
        this.activateVideoControls();
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
    onPlayerReady() {
      this.$store.commit("PLAYBACK_STATUS", PlayerStatus.ready);

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
      if (e.target.nodeName === "INPUT" || e.target.nodeName === "TEXTAREA") {
        return;
      }

      if ((e.code === "Space" || e.code === "k") && this.granted('playback.play-pause')) {
        this.togglePlayback();
        e.preventDefault();
      }
      else if (e.code === "Home" && this.granted('playback.seek')) {
        api.seek(0);
        e.preventDefault();
      }
      else if (e.code === "End" && this.granted('playback.skip')) {
        api.skip();
        e.preventDefault();
      }
      else if (e.code === "KeyF") {
        this.toggleFullscreen();
      }
      else if ((e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "KeyJ" || e.code === "KeyL") && this.granted('playback.seek')) {
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
      else if (e.code === "F12" && e.ctrlKey && e.shiftKey) {
        this.debugMode = !this.debugMode;
        e.preventDefault();
      }
      console.log(e);
    },
    toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      else {
        document.documentElement.requestFullscreen();
        if (this.isMobile) {
          // force the device into landscape mode to get the user to rotate the device
          // but still allow exiting fullscreen by rotating the device back to portrait
          screen.orientation.lock('landscape').then(() => screen.orientation.unlock());
        }
      }
    },
    async onTabChange() {
      if ("settings" in this.$refs && this.queueTab === 2) {
        await this.$refs["settings"].loadRoomSettings();
      }
    },
    onVideoBuffer(percent) {
      this.$store.commit("PLAYBACK_STATUS", PlayerStatus.buffering);
      this.$store.commit("PLAYBACK_BUFFER", percent);
    },
    onVideoError() {
      this.$store.commit("PLAYBACK_STATUS", PlayerStatus.error);
    },
    setVideoControlsVisibility(visible) {
      this.debugLastControlsVisibility = visible;
      let controlsDiv = document.getElementsByClassName("video-controls");
      let swallowerDiv = document.getElementById("mouse-event-swallower");
      if (controlsDiv.length) {
        controlsDiv = controlsDiv[0];
        if (visible) {
          controlsDiv.classList.remove("hide");
        }
        else {
          controlsDiv.classList.add("hide");
        }
      }
      if (swallowerDiv) {
        if (visible) {
          swallowerDiv.classList.add("hide");
        }
        else {
          swallowerDiv.classList.remove("hide");
        }
      }
      if (this.videoControlsHideTimeout) {
        clearTimeout(this.videoControlsHideTimeout);
        this.videoControlsHideTimeout = null;
      }
    },
    /**
     * Show the video controls, then hide them after a delay.
     */
    activateVideoControls() {
      this.setVideoControlsVisibility(true);
      this.videoControlsHideTimeout = setTimeout(() => {
        this.setVideoControlsVisibility(false);
      }, 3000);
    },
    rewriteUrlToRoomName() {
      if (this.$store.state.room.name.length === 0) {
        return;
      }
      if (this.$route.params.roomId !== this.$store.state.room.name) {
        console.log(`room name does not match URL, rewriting to "${this.$store.state.room.name}"`);
        this.$router.replace({ name: "room", params: { roomId: this.$store.state.room.name } });
      }
    },
    seekDelta(delta) {
      api.seek(_.clamp(this.truePosition + delta, 0, this.$store.state.room.currentSource.length));
    },
    activateTextSeek() {
      if (!this.granted('playback.seek')) {
        return;
      }
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
          api.seek(seconds);
        }
        catch {
          console.log("Invalid timestamp, ignoring");
        }
      }
    },
    onRoomCreated() {
      // if (this.$store.state.socket.isConnected) {
      //   this.$disconnect();
      // }
      // setTimeout(() => {
      //   if (!this.$store.state.socket.isConnected) {
      //     this.$connect(`${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${this.$route.params.roomId}`);
      //   }
      // }, 100);
    },
    switchToAddTab() {
      this.queueTab = 1;
    },
    onScreenOrientationChange() {
      this.orientation = screen.orientation.type;

      if (this.isMobile) {
        if (this.orientation.startsWith("landscape")) {
          document.documentElement.requestFullscreen();
          goTo(0, {
            duration: 250,
            easing: 'easeInOutCubic',
          });
        }
        else {
          document.exitFullscreen();
        }
      }
    },
    /**
     * Computes the `process` property of the playback position slider.
     * Used to show colored intervals in the slider.
     * Intervals will be layared in the order of they are listed. The last interval will appear on the top.
     * Values are from 0 to 100, regardless of min and max values of the slider.
     */
    getSliderProcesses(dotsPos) {
      let processes = [];

      const bufferedColor = "#e9be57";
      // show buffered spans
      if (this.$store.state.playerBufferSpans) {
        for (let i = 0; i < this.$store.state.playerBufferSpans.length; i++) {
          let start = this.$store.state.playerBufferSpans.start(i) / this.$store.state.room.currentSource.length;
          let end = this.$store.state.playerBufferSpans.end(i) / this.$store.state.room.currentSource.length;
          processes.push([
            start, end, { backgroundColor: bufferedColor },
          ]);
        }
      }
      else if (this.$store.state.playerBufferPercent) {
        processes.push([
          0, this.$store.state.playerBufferPercent * 100, { backgroundColor: bufferedColor },
        ]);
      }

      // show seek preview, if present
      processes.push([
        0, (this.seekPreview ?? 0) * 100, { backgroundColor: "#00b3ff" },
      ]);

      // show video progress
      processes.push([
          0, dotsPos[0], { backgroundColor: "#ffb300" },
      ]);

      // show sponsorblock segments
      const colorMap = new Map([
        ["sponsor", "#00d400"],
        ["selfpromo", "#ffff00"],
        ["interaction", "#cc00ff"],
        ["intro", "#00ffff"],
        ["outro", "#0202ed"],
      ]);
      if ("videoSegments" in this.$store.state.room) {
        for (const segment of this.$store.state.room.videoSegments) {
          let start = segment.startTime / segment.videoDuration * 100;
          let end = segment.endTime / segment.videoDuration * 100;
          processes.push([
            start, end, { backgroundColor: colorMap.get(segment.category) ?? "#ff0000" },
          ]);
        }
      }

      return processes;
    },
    updateSeekPreview(e) {
      let slider = document.getElementById("videoSlider");
      let sliderRect = slider.getBoundingClientRect();
      let sliderPos = e.clientX - sliderRect.left;
      this.seekPreview = sliderPos / sliderRect.width;
    },
    resetSeekPreview() {
      this.seekPreview = null;
    },
  },
  mounted() {
    console.log(this.$store.state.joinFailReason);
    console.log(this.showJoinFailOverlay);
    console.log(this.joinFailReason);
    this.$events.on("playVideo", () => {
      this.$refs.player.play();
    });
    this.$events.on("pauseVideo", () => {
      this.$refs.player.pause();
    });

    document.onmousemove = () => {
      if (this.$store.state.room.isPlaying) {
        this.activateVideoControls();
      }
    };

    let slider = document.getElementById("videoSlider");
    slider.addEventListener("mousemove", this.updateSeekPreview);
    slider.addEventListener("mouseleave", this.resetSeekPreview);

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
  updated() {
    let slider = document.getElementById("videoSlider");
    slider.removeEventListener("mousemove", this.updateSeekPreview);
    slider.removeEventListener("mouseleave", this.resetSeekPreview);
    slider.addEventListener("mousemove", this.updateSeekPreview);
    slider.addEventListener("mouseleave", this.resetSeekPreview);
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

.video-controls {
  position: absolute;
  bottom: 0;

  background: linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0));
  transition: all 0.2s;

  &.hide {
    opacity: 0;
    transition: all 0.5s;
    bottom: -100%;
  }
}

#mouse-event-swallower {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;

  &.hide {
    display: none;
  }
}

.user-invite-container {
  padding: 0 10px;
  min-height: 500px;

  > * {
    margin-bottom: 10px;
  }
}

.queue-tab-content {
  background: transparent !important;
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
    height: 100vh;
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

  @media only screen and (max-aspect-ratio: 16/9) {
    .video-subcontainer {
      width: 100%;
    }

    .chat-container {
      display: none;
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
