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
						<template #append v-if="!room.isTemporary">
							<v-btn
								icon
								variant="text"
								color="error"
								@click.stop.prevent="openDeleteDialog(room)"
							>
								<v-icon icon="mdi-delete" />
							</v-btn>
						</template>
					</v-list-item>
				</v-list>
			</v-col>
		</v-row>
		<v-dialog v-model="showDeleteDialog" max-width="500">
			<v-card>
				<v-card-title class="text-h6">{{ $t("common.delete") }}</v-card-title>
				<v-card-text>
					{{
						$t("my-rooms.confirm-delete", {
							name: roomPendingDelete ? roomPendingDelete.name : "",
						})
					}}
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="closeDeleteDialog">{{
						$t("common.cancel")
					}}</v-btn>
					<v-btn color="error" variant="flat" @click="confirmDelete">{{
						$t("common.delete")
					}}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-container>
</template>

<script lang="ts" setup>
import type { OttResponseBody, RoomListItem } from "ott-common/models/rest-api";
import { onMounted, ref } from "vue";
import { API } from "@/common-http";
import { useStore } from "@/store";
import { createRoomHelper } from "@/util/roomcreator";

const isLoading = ref(false);
const rooms = ref<RoomListItem[]>([]);
const store = useStore();
const showDeleteDialog = ref(false);
const roomPendingDelete = ref<RoomListItem | null>(null);

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

function openDeleteDialog(room: RoomListItem) {
	roomPendingDelete.value = room;
	showDeleteDialog.value = true;
}

function closeDeleteDialog() {
	showDeleteDialog.value = false;
	roomPendingDelete.value = null;
}

async function confirmDelete() {
	if (!roomPendingDelete.value) {
		closeDeleteDialog();
		return;
	}
	await deleteOwnedRoom(roomPendingDelete.value);
	closeDeleteDialog();
}

async function deleteOwnedRoom(room: RoomListItem) {
	try {
		const response = await API.delete(`/room/${encodeURIComponent(room.name)}`, {
			params: { permanent: true },
		});
		const data: OttResponseBody<unknown> = response.data;
		// If the server returns a standard OttResponseBody with success=false, handle it
		// Otherwise assume success on 2xx
		if (!data.success) {
			console.error("Failed to delete room:", data.error);
			return;
		}
		rooms.value = rooms.value.filter(r => r.name !== room.name);
	} catch (err) {
		console.error("Failed to delete room:", err);
	}
}
</script>

<style lang="scss" scoped></style>
