<template>
  <fragment>
    <v-list-item @click="$emit('createtemp')">
      <v-list-item-icon>
        <v-icon>fas fa-plus-square</v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>Create Temporary Room</v-list-item-title>
        <v-list-item-subtitle class="text-muted">Start watching videos with your friends ASAP.</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-list-item @click="$emit('createperm')">
      <v-list-item-icon>
        <v-icon>fas fa-plus-square</v-icon>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>Create Permanent Room</v-list-item-title>
        <v-list-item-subtitle class="text-muted">Perfect for frequent visitors.</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
  </fragment>
</template>

<script>
export default {
  name: "NavCreateRoom",
};
</script>
