<template>
  <v-app id="app">
    <v-content>
      <v-app-bar>
        <v-app-bar-nav-icon></v-app-bar-nav-icon>
        <v-toolbar-title>
          <router-link class="link-invis" to="/">
            OpenTogetherTube
          </router-link>
        </v-toolbar-title>
        <v-toolbar-items>

        </v-toolbar-items>
      </v-app-bar>
      <router-view/>
    </v-content>
  </v-app>
</template>

<style lang="scss">
.link-invis {
  text-decoration: none;
  color: inherit !important;
}
</style>
