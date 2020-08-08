<template>
  <v-app id="app">
    <div class="announcement-container">
      <v-alert class="announcement" type="warning" border="left" dismissible close-label="Close Announcement" v-model="showAnnouncement" transition="scroll-y-transition">
        SYSTEM: {{ announcement }}
      </v-alert>
    </div>
    <v-app-bar app :absolute="!$store.state.fullscreen" :inverted-scroll="$store.state.fullscreen">
      <v-img :src="require('@/assets/logo.svg')" max-width="32" max-height="32" contain style="margin-right: 8px" />
      <v-toolbar-title>
        <router-link class="link-invis" style="margin-right: 10px" to="/">
          OpenTogetherTube
        </router-link>
      </v-toolbar-title>
      <v-toolbar-items>
        <v-btn text to="/rooms">Browse</v-btn>
        <v-btn text to="/faq">FAQ</v-btn>
      </v-toolbar-items>
      <v-spacer />
      <v-toolbar-items>
        <v-menu offset-y>
          <template v-slot:activator="{ on }">
            <v-btn text v-on="on">
              <v-icon class="side-pad">fas fa-plus-square</v-icon>Create Room
            </v-btn>
          </template>
          <v-list two-line max-width="400">
            <v-list-item @click="createTempRoom">
              <v-list-item-icon>
                <v-icon>fas fa-plus-square</v-icon>
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Create Temporary Room</v-list-item-title>
                <v-list-item-subtitle class="text-muted">Start watching videos with your friends ASAP.</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
            <v-list-item @click="showCreateRoomForm = true">
              <v-list-item-icon>
                <v-icon>fas fa-plus-square</v-icon>
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title>Create Permanent Room</v-list-item-title>
                <v-list-item-subtitle class="text-muted">Perfect for frequent visitors.</v-list-item-subtitle>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn text @click="showLogin = true" v-if="!$store.state.user">
          Log In
        </v-btn>
        <v-menu offset-y v-if="$store.state.user">
          <template v-slot:activator="{ on }">
            <v-btn text v-on="on" :key="$store.state.user.username">
              {{ $store.state.user.username }}
            </v-btn>
          </template>
          <v-list two-line max-width="400">
            <v-list-item href="/api/user/auth/discord" target="_blank" v-if="!$store.state.user.discordLinked">
              <v-list-item-content>
                <v-list-item-title>Link Discord</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item @click="logout">
              <v-list-item-content>
                <v-list-item-title>Log Out</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-toolbar-items>
    </v-app-bar>
    <v-content>
      <router-view/>
    </v-content>
    <v-container>
      <v-dialog v-model="showCreateRoomForm" persistent max-width="600">
        <CreateRoomForm @roomCreated="showCreateRoomForm = false" @cancel="showCreateRoomForm = false" />
      </v-dialog>
    </v-container>
    <v-container>
      <v-dialog v-model="showLogin" max-width="600">
        <LogInForm @shouldClose="showLogin = false" />
      </v-dialog>
    </v-container>
    <v-overlay :value="isLoadingCreateRoom">
      <v-container fill-height>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="4">
            <v-progress-circular indeterminate />
            <v-btn elevation="12" x-large @click="cancelRoom" style="margin-top: 24px">Cancel</v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-overlay>
  </v-app>
</template>

<script>
import { API } from "@/common-http.js";
import CreateRoomForm from "@/components/CreateRoomForm.vue";
import LogInForm from "@/components/LogInForm.vue";
import RoomUtilsMixin from "@/mixins/RoomUtils.js";

export default {
  name: "app",
  components: {
    CreateRoomForm,
    LogInForm,
  },
  mixins: [RoomUtilsMixin],
  data() {
    return {
      announcement: null,
      showAnnouncement: false,
      showCreateRoomForm: false,
      showLogin: false,
    };
  },
  methods: {
    onAnnouncement(text) {
      this.showAnnouncement = true;
      this.announcement = text;
    },
    logout() {
      API.post("/user/logout").then(res => {
        if (res.data.success) {
          this.$store.commit("LOGOUT");
        }
      });
    },
  },
  created() {
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        this.$store.state.fullscreen = true;
      }
      else {
        this.$store.state.fullscreen = false;
      }
    });

    this.$events.on("onAnnouncement", this.onAnnouncement);

    // ask the server if we are logged in or not, and update the client to reflect that status.
    API.get("/user").then(res => {
      if (res.data.loggedIn) {
        let user = res.data;
        delete user.loggedIn;
        this.$store.commit("LOGIN", user);
      }
    });
  },
};
</script>

<style lang="scss">
.link-invis {
  text-decoration: none;
  color: inherit !important;
}

.side-pad {
  margin: 0 4px;
}

.vue-slider-process {
  background: #ffb300 !important;
}

.announcement-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10000;

  .announcement {
    margin: 10px;
  }
}

.text-muted {
  opacity: 0.7;
}
</style>
