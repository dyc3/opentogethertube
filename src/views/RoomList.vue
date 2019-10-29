<template>
  <v-container class="room-list" grid-list-md>
    <v-row justify="center" v-if="isLoading">
      <v-progress-circular indeterminate/>
    </v-row>
    <v-row wrap v-if="!isLoading">
      <v-col cols="6" sm="4" md="3" v-for="(room, index) in rooms" :key="index">
        <v-card hover class="room" :to="`/room/${room.name}`">
          <v-img :src="room.currentSource.thumbnail ? room.currentSource.thumbnail : require('@/assets/placeholder.svg')">
            <span class="subtitle-2 users">{{ room.users }} <v-icon small>fas fa-user-friends</v-icon></span>
          </v-img>
          <v-card-title v-text="room.isTemporary ? 'Temporary Room' : room.name" />
          <v-card-text>
            <div class="description" v-if="room.description">{{ room.description }}</div>
            <div class="description empty" v-else>No description.</div>

            <div class="video-title" v-if="room.currentSource.title">{{ room.currentSource.title }}</div>
            <div class="video-title empty" v-else>Nothing playing.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
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
.empty {
  font-style: italic;
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
