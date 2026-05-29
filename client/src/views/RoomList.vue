<template>
	<div class="mx-auto max-w-6xl px-6 py-12">
		<div v-if="isLoading" class="flex min-h-[50vh] items-center justify-center">
			<Spinner class="size-10 text-primary" />
		</div>

		<div
			v-if="rooms.length === 0 && !isLoading"
			class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center"
		>
			<span class="label-mono text-signal">Empty house</span>
			<h1 class="font-display text-5xl tracking-wide">{{ $t("room-list.no-rooms") }}</h1>
			<Button variant="default" size="xl" @click="createRoom">
				{{ $t("room-list.create") }}
			</Button>
		</div>

		<template v-if="!isLoading && rooms.length > 0">
			<div class="mb-8">
				<span class="label-mono text-signal">Now showing</span>
				<h1 class="section-title font-display text-4xl tracking-wide">
					{{ $t("nav.browse") }}
				</h1>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				<router-link
					v-for="(room, index) in rooms"
					:key="index"
					:to="`/room/${room.name}`"
					class="room ticket-notch group flex flex-col overflow-hidden rounded-lg border border-line bg-card transition hover:border-primary/60 hover:shadow-[var(--glow-primary)]"
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
						<span class="users label-mono">
							{{ room.users }} <Icon :icon="mdiAccountMultiple" class="size-4" />
						</span>
					</div>
					<div class="flex flex-1 flex-col p-4">
						<h3 class="font-display text-xl tracking-wide text-foreground">
							{{ room.isTemporary ? $t("room.title-temp") : room.name }}
						</h3>
						<div class="description mt-1 text-sm text-muted-foreground" v-if="room.description">
							{{ room.description }}
						</div>
						<div class="description empty mt-1 text-sm text-dim" v-else>
							{{ $t("room-list.no-description") }}
						</div>

						<div class="video-title mt-3 text-sm text-signal" v-if="room.currentSource?.title">
							{{ room.currentSource.title }}
						</div>
						<div class="video-title empty mt-3 text-sm text-dim" v-else>
							{{ $t("room-list.nothing-playing") }}
						</div>
					</div>
				</router-link>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { mdiAccountMultiple } from "@mdi/js";
import { API } from "@/common-http";
import { ref, onMounted } from "vue";
import { createRoomHelper } from "@/util/roomcreator";
import { useStore } from "@/store";
import { useDisplay } from "@/components/ui/useDisplay";
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
.description,
.video-title {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.empty {
	font-style: italic;
}
.users {
	background: rgba(0, 0, 0, 0.8);
	padding: 2px 6px;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border-top-left-radius: 3px;
	position: absolute;
	bottom: 0;
	right: 0;
	color: var(--foreground);
	z-index: 10;
}
</style>
