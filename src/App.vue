<template>
  <v-app id="app">
    <div id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </div>
    <v-content>
      <router-view/>
    </v-content>
  </v-app>
</template>

<style lang="scss">

</style>
