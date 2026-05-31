<template>
	<Tooltip v-if="!isMobile" v-model:open="layoutTooltip">
		<TooltipTrigger as-child>
			<Button
				variant="ghost"
				size="icon"
				class="media-control"
				aria-label="Switch Layout"
				@click="rotateRoomLayout"
			>
				<Icon
					v-if="store.state.settings.roomLayout === 'theater'"
					style="transform: scaleX(180%)"
					:icon="mdiSquareOutline"
					class="size-5"
				/>
				<Icon v-else style="transform: scaleX(130%)" :icon="mdiSquareOutline" class="size-5" />
			</Button>
		</TooltipTrigger>
		<TooltipContent side="bottom">
			{{
				$t(
					store.state.settings.roomLayout === "theater"
						? "room.default-layout"
						: "room.theater-mode",
				)
			}}
		</TooltipContent>
	</Tooltip>
	<Tooltip>
		<TooltipTrigger as-child>
			<Button
				variant="ghost"
				size="icon"
				class="media-control"
				:aria-label="$t('room.toggle-fullscreen')"
				@click="toggleFullscreen()"
			>
				<Icon :icon="mdiFullscreenExit" class="size-5" />
			</Button>
		</TooltipTrigger>
		<TooltipContent side="bottom">{{ $t("room.toggle-fullscreen") }}</TooltipContent>
	</Tooltip>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mdiSquareOutline, mdiFullscreenExit } from "@mdi/js";
import { computed, onMounted, shallowRef } from "vue";
import { useStore } from "@/store";
import { RoomLayoutMode } from "@/stores/settings";
import { useRoomKeyboardShortcuts } from "@/util/keyboard-shortcuts";

const store = useStore();
const layoutTooltip = shallowRef(false);

const isMobile = computed(() => {
	return window.matchMedia("only screen and (max-width: 760px)").matches;
});

function toggleFullscreen() {
	if (document.fullscreenElement) {
		document.exitFullscreen();
	} else {
		document.documentElement.requestFullscreen();
		if (isMobile.value) {
			// force the device into landscape mode to get the user to rotate the device
			// but still allow exiting fullscreen by rotating the device back to portrait
			if (screen.orientation) {
				screen.orientation.lock("landscape").then(() => screen.orientation.unlock());
			}
		}
	}
}

function rotateRoomLayout() {
	const layouts = [RoomLayoutMode.default, RoomLayoutMode.theater];
	const newLayout =
		layouts[(layouts.indexOf(store.state.settings.roomLayout) + 1) % layouts.length];
	store.commit("settings/UPDATE", { roomLayout: newLayout });
	layoutTooltip.value = false;
}

const shortcuts = useRoomKeyboardShortcuts();
onMounted(() => {
	if (shortcuts) {
		shortcuts.bind({ code: "KeyF" }, () => toggleFullscreen());
	} else {
		console.warn("No keyboard shortcuts available");
	}
});
</script>

<style scoped>
.media-control {
	color: var(--foreground);
}
</style>
