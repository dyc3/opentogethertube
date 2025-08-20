<template>
	<v-container class="room-list" fill-height style="align-items: inherit">
		<v-row class="center-shit" v-if="isLoading" style="width: 100%">
			<v-col cols="12">
				<v-progress-circular indeterminate />
			</v-col>
		</v-row>
		<v-row v-if="rooms.length == 0 && !isLoading" class="center-shit" style="width: 100%">
			<div>
				<h1>{{ $t("room-list.no-rooms") }}</h1>
				<v-btn elevation="12" size="x-large" @click="createRoom">{{
					$t("room-list.create")
				}}</v-btn>
			</div>
		</v-row>
		<v-row v-if="!isLoading">
			<v-col cols="12" sm="4" md="3" v-for="(room, index) in rooms" :key="index">
				<v-card hover class="room" :to="`/room/${room.name}`">
					<v-img
						:src="
							room.currentSource && room.currentSource.thumbnail
								? room.currentSource.thumbnail
								: placeholderUrl
						"
						aspect-ratio="1.8"
						v-if="$vuetify.display.smAndUp"
					>
						<span class="subtitle-2 users">
							{{ room.users }} <v-icon small>mdi-account-multiple</v-icon>
						</span>
					</v-img>
					<v-card-title>
						{{ room.isTemporary ? $t("room.title-temp") : room.name }}
					</v-card-title>
					<v-card-text>
						<div class="description" v-if="room.description">
							{{ room.description }}
						</div>
						<div class="description empty" v-else>
							{{ $t("room-list.no-description") }}
						</div>

						<div
							class="video-title"
							v-if="room.currentSource && room.currentSource.title"
						>
							{{ room.currentSource.title }}
						</div>
						<div class="video-title empty" v-else>
							{{ $t("room-list.nothing-playing") }}
						</div>
					</v-card-text>
				</v-card>
			</v-col>
		</v-row>
	</v-container>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import placeholderUrl from "@/assets/placeholder.svg";
import { API } from "@/common-http";
import { useStore } from "@/store";
import { createRoomHelper } from "@/util/roomcreator";

const RoomListView = defineComponent({
	name: "RoomListView",
	setup() {
		const isLoading = ref(false);
		const rooms = ref([]);
		const store = useStore();

		onMounted(async () => {
			isLoading.value = true;
			const result = await API.get("/room/list");
			isLoading.value = false;
			rooms.value = result.data;
		});

		async function createRoom() {
			await createRoomHelper(store);
		}

		return {
			isLoading,
			rooms,

			createRoom,
			placeholderUrl,
		};
	},
});

export default RoomListView;
</script>

<style lang="scss" scoped>
.description,
.video-title {
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
