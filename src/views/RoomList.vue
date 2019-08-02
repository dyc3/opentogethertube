<template>
  <v-container class="room-list">
    <v-layout row>
      <v-flex xs6 md3>
        <v-card v-for="(room, index) in rooms" :key="index" hover :to="`/room/${room.name}`">
          <v-card-title>{{ room.name }}</v-card-title>
          <v-card-text>{{ room.users }} users in room</v-card-text>
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
      rooms: []
    }
  },
  created() {
    API.get("/room/list").then(res => {
      this.rooms = res.data;
    });
  }
}
</script>
