<template>
	<v-container class="room-list" fill-height style="align-items: inherit">
		<v-row class="center-shit" v-if="isLoading" style="width: 100%">
			<v-col cols="12">
				<v-progress-circular indeterminate />
			</v-col>
		</v-row>

		<v-row v-if="!isLoading && rooms.length === 0" class="center-shit" style="width: 100%">
			<div>
				<h1>{{ $t("room-list.no-rooms") }}</h1>
				<v-btn elevation="12" size="x-large" @click="createTempRoom">
					{{ $t("room-list.create") }}
				</v-btn>
			</div>
		</v-row>

		<v-row v-if="!isLoading && rooms.length > 0">
			<v-col cols="12" class="mb-4">
				<h1>{{ $t("nav.my-rooms") }}</h1>
			</v-col>
			<v-col cols="12">
				<v-list density="compact" nav>
					<v-list-item
						v-for="(room, index) in rooms"
						:key="index"
						:to="`/room/${room.name}`"
					>
						<v-list-item-title>
							{{ room.title ? `${room.title} (${room.name})` : room.name }}
						</v-list-item-title>
						<v-list-item-subtitle>
							<span v-if="room.description">{{ room.description }}</span>
							<span v-else>{{ $t("room-list.no-description") }}</span>
						</v-list-item-subtitle>
					</v-list-item>
				</v-list>
			</v-col>
		</v-row>
	</v-container>
</template>

<script lang="ts" setup>
import { API } from "@/common-http";
import { ref, onMounted } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "@/store";
import type { OttResponseBody, RoomListItem } from "ott-common/models/rest-api";

const isLoading = ref(false);
const rooms = ref<RoomListItem[]>([]);
const store = useStore();

onMounted(async () => {
	isLoading.value = true;
	try {
		const result = await API.get("/user/owned-rooms");
		const data: OttResponseBody<{ data: RoomListItem[] }> = result.data;
		if (data.success) {
			rooms.value = data.data;
		} else {
			console.error("Failed to fetch room list:", data.error);
		}
	} finally {
		isLoading.value = false;
	}
});

async function createTempRoom() {
	await createRoomHelper(store);
}
</script>

<style lang="scss" scoped></style>
