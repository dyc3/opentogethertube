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
            </v-responsive>
            <v-col class="video-controls">
              <vue-slider
                id="videoSlider"
                :interval="0.1"
                :lazy="true"
                v-model="sliderPosition"
                :max="$store.state.room.currentSource.length"
                :tooltip-formatter="sliderTooltipFormatter"
                :disabled="currentSource.length == null || !granted('playback.seek')"
                @change="sliderChange"
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
                <vue-slider v-model="volume" style="width: 150px; margin-left: 10px; margin-right: 20px"/>
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
                <v-btn v-if="!production" @click="api.kickMe()" :disabled="!isConnected">Kick me</v-btn>
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
                <VideoQueue @switchtab="switchToAddTab" />
              </v-tab-item>
              <v-tab-item>
                <AddPreview />
              </v-tab-item>
              <v-tab-item>
                <div class="room-settings" style="margin: 12px">
                  <v-form @submit="submitRoomSettings">
                    <v-text-field label="Title" v-model="inputRoomSettings.title" :loading="isLoadingRoomSettings" :disabled="!granted('configure-room.set-title')" />
                    <v-text-field label="Description" v-model="inputRoomSettings.description" :loading="isLoadingRoomSettings" :disabled="!granted('configure-room.set-description')" />
                    <v-select label="Visibility" :items="[{ text: 'public' }, { text: 'unlisted' }]" v-model="inputRoomSettings.visibility" :loading="isLoadingRoomSettings" :disabled="!granted('configure-room.set-visibility')" data-cy="select-visibility" />
                    <v-select label="Queue Mode" :items="[
                      { name: 'manual', value: QueueMode.Manual, description: 'Default normal behavior, works how you would expect it to. You can manually reorder items in the queue.' },
                      { name: 'vote', value: QueueMode.Vote, description: 'The highest voted video gets played next.' },
                      { name: 'loop', value: QueueMode.Loop, description: 'When the video ends, put it at the end of the queue.' },
                      { name: 'dj', value: QueueMode.Dj, description: 'When the video ends, start the same video from the beginning. Good for looping background music.' },
                    ]" v-model="inputRoomSettings.queueMode" :loading="isLoadingRoomSettings" :disabled="!granted('configure-room.set-queue-mode')" data-cy="select-queueMode">
                      <template v-slot:item="data">
                        <v-list-item-content>
                          <v-list-item-title>{{ data.item.name }}</v-list-item-title>
                          <v-list-item-subtitle>{{ data.item.description }}</v-list-item-subtitle>
                        </v-list-item-content>
                      </template>
                      <template v-slot:selection="data">
                        <v-list-item-title>{{ data.item.name }}</v-list-item-title>
                      </template>
                    </v-select>
                    <PermissionsEditor v-if="!$store.state.room.isTemporary && $store.state.user && $store.state.room.hasOwner" v-model="inputRoomSettings.permissions" :current-role="$store.state.users.you.role" />
                    <div v-else-if="$store.state.room.isTemporary">
                      Permissions are not available in temporary rooms.
                    </div>
                    <div v-else-if="!$store.state.room.hasOwner">
                      This room needs an owner before permissions can be modified.
                      <span v-if="!$store.state.user">
                        Log in to claim this room.
                      </span>
                    </div>
                    <div v-else>
                      You aren't able to modify permissions in this room.
                    </div>
                    <div class="submit">
                      <v-btn large block color="blue" v-if="!$store.state.room.isTemporary && !$store.state.room.hasOwner" :disabled="!$store.state.user" role="submit" @click="claimOwnership">Claim Room</v-btn>
                      <v-btn x-large block @click="submitRoomSettings" role="submit" :loading="isLoadingRoomSettings">Save</v-btn>
                    </div>
                  </v-form>
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
                <v-list-item>
                  <span>Is Mobile: {{ this.isMobile }}</span>
                </v-list-item>
                <v-list-item>
                  <span>Device Orientation: {{ this.orientation }}</span>
                </v-list-item>
              </v-card>
            </div>
            <UserList :users="$store.state.room.users" v-if="$store.state.room.users" />
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
        <span>{{ $store.state.joinFailureReason }}</span>
        <v-btn to="/rooms">Find Another Room</v-btn>
      </v-layout>
    </v-overlay>
  </div>
</template>

<script>
import { API } from "@/common-http.js";
import AddPreview from "@/components/AddPreview.vue";
import { secondsToTimestamp, calculateCurrentPosition, timestampToSeconds } from "@/timestamp.js";
import _ from "lodash";
import VueSlider from 'vue-slider-component';
import OmniPlayer from "@/components/OmniPlayer.vue";
import Chat from "@/components/Chat.vue";
import PermissionsEditor from "@/components/PermissionsEditor.vue";
import PermissionsMixin from "@/mixins/permissions.js";
import UserList from "@/components/UserList.vue";
import connection from "@/util/connection";
import api from "@/util/api";
import { ToastStyle } from "@/models/toast";
import { PlayerStatus, QueueMode } from 'common/models/types';
import VideoQueue from "@/components/VideoQueue.vue";

export default {
  name: 'room',
  components: {
    VideoQueue,
    PermissionsEditor,
    VueSlider,
    OmniPlayer,
    Chat,
    AddPreview,
    UserList,
  },
  mixins: [PermissionsMixin],
  data() {
    return {
      truePosition: 0,
      sliderPosition: 0,
      sliderTooltipFormatter: secondsToTimestamp,
      volume: 100,

      queueTab: 0,
      isLoadingRoomSettings: false,
      inputRoomSettings: {
        title: "",
        description: "",
        visibility: "",
        queueMode: "",
        permissions: {},
      },

      snackbarActive: false,
      snackbarText: "",

      i_timestampUpdater: null,

      copyInviteLinkSuccessText: "",

      textSeek: {
        active: false,
        value: "",
      },

      orientation: screen.orientation.type,

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
    inviteLink() {
      if (process.env.SHORT_URL) {
        return `https://${process.env.SHORT_URL}/${this.$route.params.roomId}`;
      }
      return window.location.href.split('?')[0].toLowerCase();
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
    /** Take room settings from the UI and submit them to the server. */
    async submitRoomSettings() {
      this.isLoadingRoomSettings = true;
      try {
        await API.patch(`/room/${this.$route.params.roomId}`, this.getRoomSettingsSubmit());
        this.$toast.add({
          style: ToastStyle.Success,
          content: `Settings applied`,
          duration: 4000,
        });
      }
      catch (e) {
        console.log(e);
        this.$toast.add({
          style: ToastStyle.Error,
          content: e.response.data.error.message,
          duration: 6000,
        });
      }
      this.isLoadingRoomSettings = false;
    },
    async claimOwnership() {
      this.isLoadingRoomSettings = true;
      try {
        await API.patch(`/room/${this.$route.params.roomId}`, {
          claim: true,
        });
        this.$toast.add({
          style: ToastStyle.Success,
          content: `You now own the room ${this.$route.params.roomId}.`,
          duration: 4000,
        });
      }
      catch (e) {
        console.log(e);
        this.$toast.add({
          style: ToastStyle.Error,
          content: e.response.data.error.message,
          duration: 6000,
        });
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
    },
    toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      else {
        document.documentElement.requestFullscreen();
      }
    },
    async onTabChange() {
      if (this.queueTab === 2) {
        // FIXME: we have to make an API request becuase visibility is not sent in sync messages.
        this.isLoadingRoomSettings = true;
        let res = await API.get(`/room/${this.$route.params.roomId}`);
        this.isLoadingRoomSettings = false;
        this.inputRoomSettings = _.pick(res.data, "title", "description", "visibility", "queueMode", "permissions");
      }
    },
    onVideoBuffer(percent) {
      this.$store.commit("PLAYBACK_STATUS", PlayerStatus.buffering);
      this.$store.commit("PLAYBACK_BUFFER", percent);
    },
    onVideoError() {
      this.$store.commit("PLAYBACK_STATUS", PlayerStatus.error);
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
    getRoomSettingsSubmit() {
      const propsToGrants = {
        title: "set-title",
        description: "set-description",
        visibility: "set-visibility",
        queueMode: "set-queue-mode",
      };
      let blocked = [];
      for (let prop of Object.keys(propsToGrants)) {
        if (!this.granted(`configure-room.${propsToGrants[prop]}`)) {
          blocked.push(prop);
        }
      }
      return _.omit(this.inputRoomSettings, blocked);
    },
    onScreenOrientationChange() {
      this.orientation = screen.orientation.type;
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

.room {
  @media (max-width: $md-max) {
    padding: 0;
  }
}

.textseek {
  display: inline-flex;
  width: 90px;
}

.room-settings .submit {
  position: -webkit-sticky;
  position: sticky;
  bottom: 20px;

  .v-btn {
    margin: 10px 0;
  }
}
</style>
