<template>
	<v-btn
		variant="text"
		icon
		v-if="!isMobile"
		@click="rotateRoomLayout"
		class="media-control"
		aria-label="Switch Layout"
	>
		<v-icon v-if="store.state.settings.roomLayout === 'theater'" style="transform: scaleX(180%)"
			>fa:far fa-square
		</v-icon>
		<v-icon v-else style="transform: scaleX(130%)">fa:far fa-square</v-icon>
	</v-btn>
	<v-btn
		variant="text"
		icon
		@click="toggleFullscreen()"
		class="media-control"
		:aria-label="$t('room.toggle-fullscreen')"
	>
		<v-icon>fa:fas fa-compress</v-icon>
		<v-tooltip activator="parent" location="bottom">
			<span>{{ $t("room.toggle-fullscreen") }}</span>
		</v-tooltip>
	</v-btn>
</template>

<script lang="ts">
import { defineComponent, computed, onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { RoomLayoutMode } from "@/stores/settings";
import { useRoomKeyboardShortcuts } from "@/util/keyboard-shortcuts";

export const LayoutSwitcher = defineComponent({
	name: "LayoutSwitcher",
	setup() {
		const store = useStore();

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
						screen.orientation
							.lock("landscape")
							.then(() => screen.orientation.unlock());
					}
				}
			}
		}

		function rotateRoomLayout() {
			let layouts = [RoomLayoutMode.default, RoomLayoutMode.theater];
			let newLayout =
				layouts[(layouts.indexOf(store.state.settings.roomLayout) + 1) % layouts.length];
			store.commit("settings/UPDATE", { roomLayout: newLayout });
		}

		let shortcuts = useRoomKeyboardShortcuts();
		onMounted(() => {
			if (shortcuts) {
				shortcuts.bind({ code: "KeyF" }, () => toggleFullscreen());
			} else {
				console.warn("No keyboard shortcuts available");
			}
		});

		return {
			store,
			isMobile,
			toggleFullscreen,
			rotateRoomLayout,
		};
	},
});

export default LayoutSwitcher;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
