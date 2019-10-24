<template>
  <v-container class="room-list" grid-list-md>
    <v-layout align-center v-if="isLoading">
      <v-layout justify-center>
        <v-progress-circular indeterminate/>
      </v-layout>
    </v-layout>
    <v-layout wrap v-if="!isLoading">
      <v-flex xs6 md3 v-for="(room, index) in rooms" :key="index">
        <v-card hover :to="`/room/${room.name}`">
          <v-card-title>{{ room.isTemporary ? "Temporary Room" : room.name }}</v-card-title>
          <v-card-text>{{ room.description }}</v-card-text>
          <v-card-text>{{ room.users }} users</v-card-text>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { API } from "@/common-http.js";

export default {
  name: 'room-list',
  components: {
  },
  data() {
    return {
      rooms: [],
      isLoading: false,
    };
  },
  created() {
    this.isLoading = true;
    API.get("/room/list").then(res => {
      this.isLoading = false;
      this.rooms = res.data;
    });
  },
};
</script>
