<template>
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
import { mdiFullscreenExit } from "@mdi/js";
import { computed, onMounted } from "vue";
import { useRoomKeyboardShortcuts } from "@/util/keyboard-shortcuts";

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
