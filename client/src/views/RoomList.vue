<template>
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div v-if="isLoading" class="flex min-h-[50vh] items-center justify-center">
			<Spinner class="size-10 text-primary" />
		</div>

		<div
			v-if="rooms.length === 0 && !isLoading"
			class="flex min-h-[50vh] flex-col items-center justify-center gap-6"
		>
			<span class="label-mono text-signal">{{ $t("room-list.empty-eyebrow") }}</span>
			<h1 class="font-display text-5xl tracking-wide">{{ $t("room-list.no-rooms") }}</h1>
			<Button variant="default" size="xl" @click="createRoom">
				{{ $t("room-list.create") }}
			</Button>
		</div>

		<div v-if="!isLoading && rooms.length > 0" class="flex flex-col gap-2">
			<PageHeader :eyebrow="$t('room-list.browse-eyebrow')" :title="$t('nav.browse')" />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				<router-link
					v-for="(room, index) in rooms"
					:key="index"
					:to="`/room/${room.name}`"
					class="ticket-notch flex flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary/60"
				>
					<div v-if="display.smAndUp.value" class="relative">
						<img
							:src="
								room.currentSource?.thumbnail
									? room.currentSource.thumbnail
									: placeholderUrl
							"
							class="aspect-[1.8] w-full object-cover"
						/>
						<span
							class="label-mono absolute bottom-0 right-0 z-10 inline-flex items-center gap-1 rounded-tl-md bg-black/80 px-1.5 py-0.5 text-foreground"
						>
							{{ room.users }} <Icon :icon="mdiAccountMultiple" class="size-4" />
						</span>
					</div>
					<div class="flex flex-1 flex-col p-4">
						<h3 class="font-display text-xl tracking-wide text-foreground">
							{{ room.isTemporary ? $t("room.title-temp") : room.name }}
						</h3>
						<div
							class="mt-1 truncate text-sm text-muted-foreground"
							v-if="room.description"
						>
							{{ room.description }}
						</div>
						<div class="mt-1 truncate text-sm italic text-dim" v-else>
							{{ $t("room-list.no-description") }}
						</div>

						<div
							class="mt-3 truncate text-sm text-signal"
							v-if="room.currentSource?.title"
						>
							{{ room.currentSource.title }}
						</div>
						<div class="mt-3 truncate text-sm italic text-dim" v-else>
							{{ $t("room-list.nothing-playing") }}
						</div>
					</div>
				</router-link>
			</div>
		</div>

		<AppFooter class="mt-12" />
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useDisplay } from "@/components/ui/useDisplay";
import { mdiAccountMultiple } from "@mdi/js";
import { API } from "@/common-http";
import { ref, onMounted } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "@/store";
import AppFooter from "@/components/AppFooter.vue";
import PageHeader from "@/components/PageHeader.vue";

import placeholderUrl from "@/assets/placeholder.svg";

const isLoading = ref(false);
const rooms = ref([]);
const store = useStore();
const display = useDisplay();

onMounted(async () => {
	isLoading.value = true;
	const result = await API.get("/room/list");
	isLoading.value = false;
	rooms.value = result.data;
});

async function createRoom() {
	await createRoomHelper(store);
}
</script>
