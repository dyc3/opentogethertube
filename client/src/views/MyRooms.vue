<template>
	<div class="mx-auto max-w-4xl px-6 py-12">
		<div v-if="isLoading" class="flex min-h-[50vh] items-center justify-center">
			<Spinner class="size-10 text-primary" />
		</div>

		<div
			v-if="!isLoading && rooms.length === 0"
			class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center"
		>
			<span class="label-mono text-signal">{{ $t("my-rooms.empty-eyebrow") }}</span>
			<h1 class="font-display text-5xl tracking-wide">{{ $t("room-list.no-rooms") }}</h1>
			<Button variant="default" size="xl" @click="createTempRoom">
				{{ $t("room-list.create") }}
			</Button>
		</div>

		<template v-if="!isLoading && rooms.length > 0">
			<div class="mb-8">
				<PageHeader :eyebrow="$t('my-rooms.owned-eyebrow')" :title="$t('nav.my-rooms')" />
			</div>
			<ul class="flex flex-col gap-2">
				<li v-for="(room, index) in rooms" :key="index">
					<div
						class="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/50 hover:bg-surface-2"
					>
						<router-link :to="`/room/${room.name}`" class="min-w-0 flex-1">
							<div class="font-display text-lg tracking-wide text-foreground">
								{{ room.title ? `${room.title} (${room.name})` : room.name }}
							</div>
							<div class="truncate text-sm text-muted-foreground">
								<span v-if="room.description">{{ room.description }}</span>
								<span v-else class="italic text-dim">
									{{ $t("room-list.no-description") }}
								</span>
							</div>
						</router-link>
						<Button
							v-if="!room.isTemporary"
							variant="ghost"
							size="icon"
							class="text-destructive hover:text-destructive"
							@click.stop.prevent="openDeleteDialog(room)"
						>
							<Icon :icon="mdiDelete" class="size-5" />
						</Button>
					</div>
				</li>
			</ul>
		</template>

		<Dialog v-model:open="showDeleteDialog">
			<DialogContent class="max-w-md sm:max-w-md">
				<DialogHeader>
					<DialogTitle class="font-display text-2xl tracking-wide">
						{{ $t("common.delete") }}
					</DialogTitle>
					<DialogDescription>
						{{
							$t("my-rooms.confirm-delete", {
								name: roomPendingDelete ? roomPendingDelete.name : "",
							})
						}}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter class="gap-2">
					<Button variant="ghost" @click="closeDeleteDialog">
						{{ $t("common.cancel") }}
					</Button>
					<Button variant="destructive" @click="confirmDelete">
						{{ $t("common.delete") }}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { mdiDelete } from "@mdi/js";
import { API } from "@/common-http";
import { ref, onMounted } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "@/store";
import type { OttResponseBody, RoomListItem } from "ott-common/models/rest-api";
import PageHeader from "@/components/PageHeader.vue";

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

<style scoped>
.section-title {
	position: relative;
	padding-left: 1rem;
	margin-top: 0.25rem;
}
.section-title::before {
	content: "";
	position: absolute;
	left: 0;
	top: 0.1em;
	bottom: 0.1em;
	width: 4px;
	background: var(--primary);
	box-shadow: 0 0 12px var(--primary);
}
</style>
