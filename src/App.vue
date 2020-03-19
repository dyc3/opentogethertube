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
    </v-app-bar>
    <v-content>
      <router-view/>
    </v-content>
  </v-app>
</template>

<script>
export default {
  name: "app",
  data() {
    return {
      announcement: null,
      showAnnouncement: false,
    };
  },
  methods: {
    onAnnouncement(text) {
      this.showAnnouncement = true;
      this.announcement = text;
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
  },
  watch:{
    $route (to) {
      if (to.name != "room" && this.$store.state.socket.isConnected) {
        this.$disconnect();
      }
    },
  },
};
</script>

<style lang="scss">
.link-invis {
  text-decoration: none;
  color: inherit !important;
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
</style>
