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
              <YoutubePlayer v-if="currentSource.service == 'youtube'" class="player" ref="youtube" :video-id="currentSource.id" @playing="onPlaybackChange(true)" @paused="onPlaybackChange(false)" @ready="onPlayerReady" @buffering="onVideoBuffer" @error="onVideoError" />
              <VimeoPlayer v-else-if="currentSource.service == 'vimeo'" class="player" ref="vimeo" :video-id="currentSource.id" @playing="onPlaybackChange(true)" @paused="onPlaybackChange(false)" @ready="onPlayerReady" @buffering="onVideoBuffer" @error="onVideoError" />
              <DailymotionPlayer v-else-if="currentSource.service == 'dailymotion'" class="player" ref="dailymotion" :video-id="currentSource.id" @playing="onPlaybackChange(true)" @paused="onPlaybackChange(false)" @ready="onPlayerReady" @buffering="onVideoBuffer" @error="onVideoError" />
              <v-container fluid fill-height class="player no-video" v-else>
                <v-row justify="center" align="center">
                  <div>
                    <h1>No video is playing.</h1>
                    <span>Click "Add" below to add a video.</span>
                  </div>
                </v-row>
              </v-container>
            </v-responsive>
            <v-col class="video-controls">
              <vue-slider id="videoSlider" v-model="sliderPosition" @change="sliderChange" :max="$store.state.room.currentSource.length" :tooltip-formatter="sliderTooltipFormatter" :disabled="currentSource.length == null"/>
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
          </div>
          <div cols="12" :xl="$store.state.fullscreen ? 3 : 5" md="4" class="chat-container">
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
                <div class="video-add">
                  <div>
                    <v-text-field clearable placeholder="Type to search YouTube or enter a Video URL to add to the queue" v-model="inputAddPreview" @keydown="onInputAddPreviewKeyDown" @focus="onInputAddPreviewFocus" :loading="isLoadingAddPreview" />
                    <v-btn v-if="!production" @click="postTestVideo(0)">Add test youtube 0</v-btn>
                    <v-btn v-if="!production" @click="postTestVideo(1)">Add test youtube 1</v-btn>
                    <v-btn v-if="!production" @click="postTestVideo(2)">Add test vimeo 2</v-btn>
                    <v-btn v-if="!production" @click="postTestVideo(3)">Add test vimeo 3</v-btn>
                    <v-btn v-if="!production" @click="postTestVideo(4)">Add test dailymotion 4</v-btn>
                    <v-btn v-if="addPreview.length > 1" @click="addAllToQueue()">Add All</v-btn>
                  </div>
                  <v-row v-if="isLoadingAddPreview" justify="center">
                    <v-progress-circular indeterminate/>
                  </v-row>
                  <div v-if="!isLoadingAddPreview">
                    <v-row justify="center">
                      <div v-if="hasAddPreviewFailed">
                        {{ addPreviewLoadFailureText }}
                      </div>
                      <v-container fill-height v-if="addPreview.length == 0 && inputAddPreview.length > 0 && !hasAddPreviewFailed && !isAddPreviewInputUrl">
                        <v-row justify="center" align="center">
                          <v-col cols="12">
                            Search YouTube for "{{ inputAddPreview }}" by pressing enter, or by clicking search.<br>
                            <v-btn @click="requestAddPreviewExplicit">Search</v-btn>
                          </v-col>
                        </v-row>
                      </v-container>
                    </v-row>
                    <div v-if="highlightedAddPreviewItem">
                      <VideoQueueItem :item="highlightedAddPreviewItem" is-preview style="margin-bottom: 20px"/>
                      <h4>Playlist</h4>
                    </div>
                    <VideoQueueItem v-for="(itemdata, index) in addPreview" :key="index" :item="itemdata" is-preview/>
                  </div>
                </div>
              </v-tab-item>
              <v-tab-item>
                <div class="room-settings">
                  <v-form @submit="submitRoomSettings">
                    <v-text-field label="Title" v-model="inputRoomSettingsTitle" :loading="isLoadingRoomSettings" />
                    <v-text-field label="Description" v-model="inputRoomSettingsDescription" :loading="isLoadingRoomSettings" />
                    <v-select label="Visibility" :items="[{ text: 'public' }, { text: 'unlisted' }]" v-model="inputRoomSettingsVisibility" :loading="isLoadingRoomSettings" />
                    <v-select label="Queue Mode" :items="[{ text: 'manual' }, { text: 'vote' }]" v-model="inputRoomSettingsQueueMode" :loading="isLoadingRoomSettings" />
                    <v-btn @click="submitRoomSettings" role="submit" :loading="isLoadingRoomSettings">Save</v-btn>
                  </v-form>
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
                  <v-icon class="player-status" v-if="user.status === 'buffering'">fas fa-spinner</v-icon>
                  <v-icon class="player-status" v-else-if="user.status === 'ready'">fas fa-check</v-icon>
                  <v-icon class="player-status" v-else-if="user.status === 'error'">fas fa-exclamation</v-icon>
                </v-list-item>
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
    <v-snackbar v-for="(event, index) in $store.state.room.events" :key="index" v-model="event.isVisible">
      {{ snackbarText }}
      <v-btn @click="undoEvent(event, index)" v-if="event.isUndoable">Undo</v-btn>
    </v-snackbar>
  </div>
</template>

<script>
import { API } from "@/common-http.js";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import secondsToTimestamp from "@/timestamp.js";
import _ from "lodash";
import draggable from 'vuedraggable';
import VueSlider from 'vue-slider-component';

export default {
  name: 'room',
  components: {
    draggable,
    VideoQueueItem,
    VueSlider,
    YoutubePlayer: () => import(/* webpackChunkName: "youtube" */"@/components/YoutubePlayer.vue"),
    VimeoPlayer: () => import(/* webpackChunkName: "vimeo" */"@/components/VimeoPlayer.vue"),
    DailymotionPlayer: () => import(/* webpackChunkName: "dailymotion" */"@/components/DailymotionPlayer.vue"),
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
      hasAddPreviewFailed: false,
      addPreviewLoadFailureText: "",
      inputAddPreview: "",
      inputChatMsgText: "",
      shouldChatStickToBottom: true,
      isLoadingRoomSettings: false,
      inputRoomSettingsTitle: "",
      inputRoomSettingsDescription: "",
      inputRoomSettingsVisibility: "",
      inputRoomSettingsQueueMode: "",

      showJoinFailOverlay: false,
      joinFailReason: "",
      snackbarActive: false,
      snackbarText: "",
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
    timestampDisplay() {
      const position = secondsToTimestamp(this.$store.state.room.playbackPosition);
      const duration = secondsToTimestamp(this.$store.state.room.currentSource.length || 0);
      return `${position} / ${duration}`;
    },
    isAddPreviewInputUrl() {
      try {
        if (new URL(this.inputAddPreview).host) {
          return true;
        }
        else {
          return false;
        }
      }
      catch (e) {
        return false;
      }
    },
    highlightedAddPreviewItem() {
      return _.find(this.addPreview, { highlight: true });
    },
  },
  async created() {
    // if (!this.$store.state.production) {
    //   // HACK: get the server to set the session cookie
    //   // this isn't needed in production because the requests for resources will set the cookie
    //   await API.get("/user");
    // }

    this.$events.on("onSync", () => {
      this.sliderPosition = this.$store.state.room.playbackPosition;
    });

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
        this.snackbarText = `${event.userName} added ${event.parameters.video.title}`;
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
      this.$connect(`${window.location.protocol.startsWith("https") ? "wss" : "ws"}://${window.location.host}/api/room/${this.$route.params.roomId}`);
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
        "https://vimeo.com/94338566",
        "https://vimeo.com/239423699",
        "https://www.dailymotion.com/video/x6hkywd",
      ];
      API.post(`/room/${this.$route.params.roomId}/queue`, {
        url: videos[v],
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
        url: this.inputAddPreview,
      });
    },
    addAllToQueue() {
      for (let video of this.addPreview) {
        API.post(`/room/${this.$route.params.roomId}/queue`, video);
      }
    },
    openEditName() {
      this.username = this.$store.state.user ? this.$store.state.user.username : this.$store.state.username;
      this.showEditName = !this.showEditName;
    },
    play() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.play();
      }
      else if (this.currentSource.service === "vimeo") {
        this.$refs.vimeo.play();
      }
      else if (this.currentSource.service === "dailymotion") {
        this.$refs.dailymotion.play();
      }
    },
    pause() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.pause();
      }
      else if (this.currentSource.service === "vimeo") {
        this.$refs.vimeo.pause();
      }
      else if (this.currentSource.service === "dailymotion") {
        this.$refs.dailymotion.pause();
      }
    },
    updateVolume() {
      if (this.currentSource.service == "youtube") {
        this.$refs.youtube.setVolume(this.volume);
      }
      else if (this.currentSource.service === "vimeo") {
        this.$refs.vimeo.setVolume(this.volume);
      }
      else if (this.currentSource.service === "dailymotion") {
        this.$refs.dailymotion.setVolume(this.volume);
      }
    },
    requestAddPreview() {
      API.get(`/data/previewAdd?input=${encodeURIComponent(this.inputAddPreview)}`, { validateStatus: status => status < 500 }).then(res => {
        this.isLoadingAddPreview = false;
        if (res.status === 200) {
          this.hasAddPreviewFailed = false;
          this.addPreview = res.data;
          console.log(`Got add preview with ${this.addPreview.length}`);
        }
        else if (res.status === 400) {
          this.hasAddPreviewFailed = true;
          this.addPreviewLoadFailureText = res.data.error.message;
          if (res.data.error.name === "FeatureDisabledException" && !this.isAddPreviewInputUrl) {
            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(this.inputAddPreview)}`, "_blank");
          }
        }
        else {
          console.warn("Unknown status for add preview response:", res.status);
        }
      }).catch(err => {
        this.isLoadingAddPreview = false;
        this.hasAddPreviewFailed = true;
        this.addPreviewLoadFailureText = "An unknown error occurred when getting add preview. Try again later.";
        console.error("Failed to get add preview", err);
      });
    },
    requestAddPreviewDebounced: _.debounce(function() {
      // HACK: can't use an arrow function here because it will make `this` undefined
      this.requestAddPreview();
    }, 500),
    /**
     * Request an add preview regardless of the current input.
     */
    requestAddPreviewExplicit() {
      this.isLoadingAddPreview = true;
      this.hasAddPreviewFailed = false;
      this.addPreview = [];
      this.requestAddPreview();
    },
    onEditNameChange() {
      this.$socket.sendObj({ action: "set-name", name: this.username });
      this.showEditName = false;
    },
    onPlaybackChange(changeTo) {
      if (this.currentSource.service === "youtube" || this.currentSource.service === "dailymotion") {
        this.$store.commit("PLAYBACK_STATUS", "ready");
      }
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
    onInputAddPreviewChange() {
      this.isLoadingAddPreview = true;
      this.hasAddPreviewFailed = false;
      if (_.trim(this.inputAddPreview).length == 0) {
        this.addPreview = [];
        this.isLoadingAddPreview = false;
        return;
      }
      if (!this.isAddPreviewInputUrl) {
        this.addPreview = [];
        this.isLoadingAddPreview = false;
        // Don't send API requests for non URL inputs without the user's explicit input to do so.
        // This is to help conserve youtube API quota.
        return;
      }
      this.requestAddPreviewDebounced();
    },
    onInputAddPreviewKeyDown(e) {
      if (_.trim(this.inputAddPreview).length == 0 || this.isAddPreviewInputUrl) {
        return;
      }

      if (e.keyCode === 13 && this.addPreview.length == 0) {
        this.requestAddPreviewExplicit();
      }
    },
    onInputAddPreviewFocus(e) {
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
        this.play();
      }
      else {
        this.pause();
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
        this.shouldChatStickToBottom = true;
      }
    },
    onChatScroll() {
      let msgsDiv = document.getElementsByClassName("messages");
      if (msgsDiv.length) {
        msgsDiv = msgsDiv[0];
        let distToBottom = msgsDiv.scrollHeight - msgsDiv.clientHeight - msgsDiv.scrollTop;
        this.shouldChatStickToBottom = distToBottom == 0;
      }
    },
    onQueueDragDrop(e) {
      this.$socket.sendObj({
        action: "queue-move",
        currentIdx: e.oldIndex,
        targetIdx: e.newIndex,
      });
    },
    undoEvent(event, idx) {
      this.$socket.sendObj({
        action: "undo",
        event,
      });
      this.$store.state.room.events.splice(idx, 1);
    },
    onTabChange() {
      if (this.queueTab === 2) {
        // FIXME: we have to make an API request becuase visibility is not sent in sync messages.
        this.isLoadingRoomSettings = true;
        API.get(`/room/${this.$route.params.roomId}`).then(res => {
          this.isLoadingRoomSettings = false;
          this.inputRoomSettingsTitle = res.data.title;
          this.inputRoomSettingsDescription = res.data.description;
          this.inputRoomSettingsVisibility = res.data.visibility;
          this.inputRoomSettingsQueueMode = res.data.queueMode;
        });
      }
    },
    submitRoomSettings() {
      this.isLoadingRoomSettings = true;
      API.patch(`/room/${this.$route.params.roomId}`, {
        title: this.inputRoomSettingsTitle,
        description: this.inputRoomSettingsDescription,
        visibility: this.inputRoomSettingsVisibility,
        queueMode: this.inputRoomSettingsQueueMode,
      }).then(() => {
        this.isLoadingRoomSettings = false;
      });
    },
    onVideoBuffer() {
      this.$store.commit("PLAYBACK_STATUS", "buffering");
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

    let msgsDiv = document.getElementsByClassName("messages");
    if (msgsDiv.length) {
      msgsDiv = msgsDiv[0];
      msgsDiv.onscroll = this.onChatScroll;
    }
    else {
      console.error("Couldn't find chat messages div");
    }

    document.onmousemove = () => {
      let controlsDiv = document.getElementsByClassName("video-controls");
      if (controlsDiv.length) {
        controlsDiv = controlsDiv[0];
        controlsDiv.classList.remove("hide");
      }
      this.hideVideoControls();
    };
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
      let currentTime = null;
      if (this.currentSource.service === "youtube") {
        currentTime = await this.$refs.youtube.getPosition();
      }
      else if (this.currentSource.service === "vimeo") {
        currentTime = await this.$refs.vimeo.getPosition();
      }
      else if (this.currentSource.service === "dailymotion") {
        currentTime = await this.$refs.dailymotion.getPosition();
      }
      if (Math.abs(newPosition - currentTime) > 1) {
        if (this.currentSource.service === "youtube") {
          this.$refs.youtube.setPosition(newPosition);
        }
        else if (this.currentSource.service === "vimeo") {
          this.$refs.vimeo.setPosition(newPosition);
        }
        else if (this.currentSource.service === "dailymotion") {
          this.$refs.dailymotion.setPosition(newPosition);
        }
      }
    },
    inputAddPreview() {
      // HACK: The @change event only triggers when the text field is defocused.
      // This ensures that onInputAddPreviewChange() runs everytime the text field's value changes.
      this.onInputAddPreviewChange();
    },
  },
  updated() {
    // scroll the messages to the bottom
    if (this.shouldChatStickToBottom) {
      let msgsDiv = document.getElementsByClassName("messages");
      if (msgsDiv.length) {
        msgsDiv = msgsDiv[0];
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
      }
    }
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
  }

  @media (max-width: $md-max) {
    .video-subcontainer, .chat-container {
      width: 100%;
    }
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
.video-queue, .video-add, .user-list {
  margin: 0 10px;
  min-height: 500px;
}
.queue-tab-content {
  background: transparent !important;
}
.is-you {
  color: #ffb300;
  border: 1px #ffb300 solid;
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

  h4 {
    border-bottom: 1px solid #666;
  }

  .messages {
    overflow-y: auto;
    overflow-x: hidden;

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
      word-wrap: break-word;
    }

    .from {
      font-weight: bold;
      max-width: 20%;
    }

    .text {
      min-width: 80%;
    }
  }
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
</style>
