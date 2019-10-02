<template>
  <v-app id="app">
    <v-content>
      <v-app-bar>
        <v-app-bar-nav-icon/>
        <v-img :src="require('@/assets/logo.svg')" max-width="32" max-height="32" contain style="margin-right: 8px" />
        <v-toolbar-title>
          <router-link class="link-invis" style="margin-right: 10px" to="/">
            OpenTogetherTube
          </router-link>
        </v-toolbar-title>
        <v-toolbar-items>
          <v-btn text to="/rooms">Browse</v-btn>
        </v-toolbar-items>
      </v-app-bar>
      <router-view/>
    </v-content>
  </v-app>
</template>

<script>
export default {
  name: "app",
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
</style>
