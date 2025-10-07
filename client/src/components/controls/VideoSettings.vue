<template>
	<div class="video-settings-wrapper">
		<v-btn
			variant="text"
			icon
			class="media-control"
			:aria-label="$t('room.player-settings')"
			:disabled="!isMenuSupported"
			@click="toggleMenu"
		>
			<v-icon :icon="mdiCog" />
			<v-tooltip activator="parent" location="bottom">
				{{ $t("room.player-settings") }}
			</v-tooltip>
		</v-btn>

		<v-container v-if="isMenuOpen" class="settings-menu-container">
			<div class="menu-container">
				<transition name="menu-resize" mode="out-in" slim>
					<!-- Main menu -->
					<v-list
						v-if="currentMenu === MenuType.MAIN"
						key="main"
						class="menu-content"
						min-width="300px"
					>
						<v-list-item
							v-if="isCaptionsSupported"
							link
							class="menu-item"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiClosedCaptionOutline"
							@click="navigateToMenu(MenuType.SUBTITLE)"
						>
							<div class="menu-item-content">
								<span>{{ $t("room.subtitles") }}</span>
								<span v-if="currentSubtitleDisplay" class="menu-item-value">
									{{ currentSubtitleDisplay }}
								</span>
							</div>
						</v-list-item>

						<v-list-item
							v-if="isQualitySupported"
							link
							class="menu-item"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiTune"
							@click="navigateToMenu(MenuType.QUALITY)"
						>
							<div class="menu-item-content">
								<span>{{ $t("room.quality") }}</span>
								<span class="menu-item-value">
									{{ currentQualityDisplay }}
								</span>
							</div>
						</v-list-item>
					</v-list>

					<!-- Quality submenu -->
					<v-list
						v-else-if="currentMenu === MenuType.QUALITY"
						key="quality"
						class="menu-content"
						color="primary"
					>
						<v-list-item
							link
							class="menu-header"
							min-width="150px"
							:prepend-icon="mdiChevronLeft"
							@click="navigateToMenu(MenuType.MAIN)"
						>
							{{ $t("room.quality") }}
						</v-list-item>

						<v-list-item
							v-if="qualities.isAutoQualitySupported.value"
							link
							:active="isAutoQualityActive"
							@click="selectQuality(-1)"
						>
							{{ autoQualityDisplay }}
						</v-list-item>

						<v-list-item
							v-for="(quality, idx) in qualities.videoTracks.value"
							:key="idx"
							link
							:active="idx === qualities.currentVideoTrack.value"
							@click="selectQuality(idx)"
						>
							{{ formatQuality(quality) }}
						</v-list-item>
					</v-list>

					<!-- Subtitle submenu -->
					<v-list
						v-else-if="currentMenu === MenuType.SUBTITLE"
						key="subtitle"
						class="menu-content"
						color="primary"
					>
						<v-list-item
							link
							class="menu-header"
							min-width="200px"
							:prepend-icon="mdiChevronLeft"
							@click="navigateToMenu(MenuType.MAIN)"
						>
							{{ $t("room.subtitles") }}
						</v-list-item>

						<v-list-item
							v-for="(track, idx) in captions.captionsTracks.value"
							:key="idx"
							link
							:active="isSubtitleTrackActive(track)"
							@click="selectSubtitleTrack(track)"
						>
							{{ track }}
						</v-list-item>
					</v-list>
				</transition>
			</div>
		</v-container>

		<!-- Overlay to close menu when clicking outside -->
		<div v-if="isMenuOpen" class="menu-overlay" @click="closeMenu"></div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { useCaptions, useQualities } from "../composables";
import { mdiCog, mdiClosedCaptionOutline, mdiTune, mdiChevronLeft, mdiChevronRight } from "@mdi/js";

// Menu types enum
enum MenuType {
	MAIN = "main",
	QUALITY = "quality",
	SUBTITLE = "subtitle",
}
const currentMenu = ref<MenuType>(MenuType.MAIN);
const isMenuOpen = ref<boolean>(false);

const qualities = useQualities();
const captions = useCaptions();

const isQualitySupported = computed(
	() => qualities.isQualitySupported.value && qualities.videoTracks.value.length > 0
);

const isCaptionsSupported = computed(
	() => captions.isCaptionsSupported.value && captions.captionsTracks.value.length > 0
);

const isMenuSupported = computed(() => isQualitySupported.value || isCaptionsSupported.value);

const currentSubtitleDisplay = computed(() => {
	return captions.isCaptionsEnabled.value && captions.currentTrack.value
		? captions.currentTrack.value
		: null;
});

function formatQuality(quality: number): string {
	return `${quality}p`;
}

const autoQualityDisplay = computed(() => {
	const hasActiveQuality =
		qualities.currentVideoTrack.value === -1 &&
		qualities.videoTracks.value.length > 0 &&
		qualities.currentActiveQuality.value !== null;

	const currentQuality = qualities.videoTracks.value[qualities.currentActiveQuality.value!];
	return hasActiveQuality ? `Auto (${formatQuality(currentQuality)})` : "Auto";
});

const currentQualityDisplay = computed(() => {
	const isAutoQualitySupported = qualities.isAutoQualitySupported.value;
	const currentTrack = qualities.currentVideoTrack.value;
	if (isAutoQualitySupported && currentTrack === -1) {
		return autoQualityDisplay.value;
	}

	const currentQuality = qualities.videoTracks.value[currentTrack];
	if (currentTrack >= 0 && currentQuality) {
		return formatQuality(currentQuality);
	}

	return "";
});

const isAutoQualityActive = computed(() => qualities.currentVideoTrack.value === -1);

function isSubtitleTrackActive(track: string): boolean {
	return captions.isCaptionsEnabled.value && track === captions.currentTrack.value;
}

function navigateToMenu(menu: MenuType): void {
	currentMenu.value = menu;
}

function resetToMainMenu(): void {
	currentMenu.value = MenuType.MAIN;
}

function toggleMenu(): void {
	isMenuOpen.value = !isMenuOpen.value;
	if (!isMenuOpen.value) {
		resetToMainMenu();
	}
}

function closeMenu(): void {
	isMenuOpen.value = false;
	resetToMainMenu();
}

function selectQuality(idx: number): void {
	qualities.currentVideoTrack.value = idx;
	closeMenu();
}

function selectSubtitleTrack(track: string): void {
	if (!captions.isCaptionsEnabled.value) {
		captions.isCaptionsEnabled.value = true;
	}
	captions.currentTrack.value = track;
	closeMenu();
}
</script>

<style lang="scss">
@use "./media-controls.scss";

.video-settings-wrapper {
	position: relative;
}

.settings-menu-container {
	position: absolute;
	bottom: media-controls.$video-controls-height;
	right: -90px;
	z-index: 9999;
	background: rgba(0, 0, 0, 0.7);
	border-radius: 10px;
	padding: 0;
	width: auto;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.menu-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 999;
	background: transparent;
}

.menu-container {
	border-radius: 10px;
	overflow: hidden;
}

.menu-content {
	width: 100%;
	min-height: fit-content;
	background: transparent;
}

.menu-item {
	&-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}

	&-value {
		color: #888;
		font-size: 0.875rem;
		margin-left: 1rem;
	}
}

.menu-header {
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	font-weight: 500;
}

.menu-resize-enter-active,
.menu-resize-leave-active {
	transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
	overflow: hidden;
}

.menu-resize-enter-from,
.menu-resize-leave-to {
	opacity: 0.5;
	transform: scale(0.95);
	max-height: 0;
	padding-top: 0;
	padding-bottom: 0;
}

.menu-resize-enter-to,
.menu-resize-leave-from {
	opacity: 1;
	transform: scale(1);
	max-height: 500px;
}
</style>
