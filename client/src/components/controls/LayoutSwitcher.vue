<template>
	<v-btn
		variant="text"
		icon
		v-if="!isMobile"
		@click="rotateRoomLayout"
		class="media-control"
		aria-label="Switch Layout"
	>
		<v-icon
			v-if="store.state.settings.roomLayout === 'theater'"
			style="transform: scaleX(180%)"
			:icon="mdiSquareOutline"
		/>
		<v-icon v-else style="transform: scaleX(130%)" :icon="mdiSquareOutline" />
		<v-tooltip activator="parent" location="bottom" v-model="layoutTooltip">
			<span>{{
				$t(
					store.state.settings.roomLayout === "theater"
						? "room.default-layout"
						: "room.theater-mode"
				)
			}}</span>
		</v-tooltip>
	</v-btn>
	<v-btn
		variant="text"
		icon
		@click="toggleFullscreen()"
		class="media-control"
		:aria-label="$t('room.toggle-fullscreen')"
	>
		<v-icon :icon="mdiFullscreenExit" />
		<v-tooltip activator="parent" location="bottom">
			<span>{{ $t("room.toggle-fullscreen") }}</span>
		</v-tooltip>
	</v-btn>
</template>

<script lang="ts" setup>
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

function tryVideoFullscreen() {
	const video = document.querySelector("video") as any;
	if (video?.webkitEnterFullscreen) {
		video.webkitEnterFullscreen();
	}
}

function toggleFullscreen() {
	if (document.fullscreenElement) {
		document.exitFullscreen();
		return;
	}
	const el = document.documentElement;
	if (el.requestFullscreen) {
		el.requestFullscreen().catch(() => tryVideoFullscreen());
	} else if ((el as any).webkitRequestFullscreen) {
		(el as any).webkitRequestFullscreen();
	} else {
		tryVideoFullscreen();
	}
	if (isMobile.value && screen.orientation) {
		// force landscape; allow exit by rotating back to portrait
		screen.orientation.lock("landscape").then(() => screen.orientation.unlock()).catch(() => {});
	}
}

function rotateRoomLayout() {
	const layouts = [RoomLayoutMode.default, RoomLayoutMode.theater];
	const newLayout =
		layouts[(layouts.indexOf(store.state.settings.roomLayout) + 1) % layouts.length];
	store.commit("settings/UPDATE", { roomLayout: newLayout });
	layoutTooltip.value = false;

	// Send postMessage to parent window if in embed mode
	// This allows the embedding page to adjust its layout when theater mode is toggled
	if (window.parent && window.parent !== window) {
		window.parent.postMessage({
			type: "ott-theater-mode",
			theaterMode: newLayout === RoomLayoutMode.theater
		}, "*");
	}
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

<style lang="scss">
@use "./media-controls.scss";
</style>
