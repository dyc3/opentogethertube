<template>
  <fragment>
    <v-btn text @click="$emit('login')" v-if="!$store.state.user">
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
        <v-list-item @click="$emit('logout')">
          <v-list-item-content>
            <v-list-item-title>Log Out</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </fragment>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "NavUser",
});
</script>
