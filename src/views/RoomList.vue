<template>
  <v-container class="room-list" grid-list-md>
    <v-layout align-center v-if="isLoading">
      <v-layout justify-center>
        <v-progress-circular indeterminate/>
      </v-layout>
    </v-layout>
    <v-layout wrap v-if="!isLoading">
      <v-flex xs6 md3 v-for="(room, index) in rooms" :key="index">
        <v-card hover class="room" :to="`/room/${room.name}`">
          <v-img :src="room.currentSource.thumbnail ? room.currentSource.thumbnail : require('@/assets/placeholder.svg')">
            <span class="subtitle-2 users">{{ room.users }} <v-icon small>fas fa-user-friends</v-icon></span>
          </v-img>
          <v-card-title v-text="room.isTemporary ? 'Temporary Room' : room.name" />
          <v-card-text>
            <div class="description">{{ room.description }}</div>
            <div class="video-title">{{ room.currentSource.title }}</div>
          </v-card-text>
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

<style lang="scss" scoped>
.description, .video-title {
  height: 25px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.users {
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 5px;
  border-top-left-radius: 3px;
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 1000;
}
</style>
