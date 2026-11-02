<template>
	<div class="flex h-full min-h-0 flex-col gap-1">
		<div class="flex items-center gap-1">
			<Tabs v-model="tab" class="min-w-0 flex-1">
				<TabsList class="w-full">
					<TabsTrigger value="chat" class="flex-1 gap-2" data-cy="room-panel-chat">
						<Icon :icon="mdiMessageTextOutline" class="size-4" />
						{{ $t("chat.title") }}
						<Badge v-if="unread > 0" class="ml-1" data-cy="room-panel-unread">
							{{ unread > 99 ? "99+" : $n(unread) }}
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="users" class="flex-1 gap-2" data-cy="room-panel-users">
						<Icon :icon="mdiAccountMultipleOutline" class="size-4" />
						{{ $t("room.users.title") }}
						<Badge variant="secondary" class="ml-1">
							{{ $n(store.state.users.users.size) }}
						</Badge>
					</TabsTrigger>
				</TabsList>
			</Tabs>
			<slot name="actions" />
		</div>
		<!-- Both tabs stay mounted so chat keeps receiving messages while Users is open. -->
		<div class="relative min-h-0 flex-1">
			<div v-show="tab === 'chat'" class="relative h-full"><slot name="chat" /></div>
			<div v-show="tab === 'users'" class="h-full overflow-y-auto">
				<slot name="users" />
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { mdiAccountMultipleOutline, mdiMessageTextOutline } from "@mdi/js";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/store";
import { chatMessagePast, chatMessageRecent } from "./chat-state";

export type RoomSidePanelTab = "chat" | "users";

const tab = defineModel<RoomSidePanelTab>("tab", { default: "chat" });

const store = useStore();

const totalMessages = computed(() => chatMessagePast.value.length + chatMessageRecent.value.length);
const seenMessages = ref(totalMessages.value);
const unread = computed(() =>
	tab.value === "chat" ? 0 : totalMessages.value - seenMessages.value,
);
watch(
	[tab, totalMessages],
	() => {
		if (tab.value === "chat") {
			seenMessages.value = totalMessages.value;
		}
	},
	{ immediate: true },
);
</script>
