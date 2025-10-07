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
				<transition name="menu-resize" mode="out-in" slim variant="text">
					<!-- Main menu -->
					<v-list
						v-if="currentMenu == 'main'"
						key="main"
						class="menu-content"
						min-width="300px"
					>
						<v-list-item
							link
							@click="currentMenu = 'subtitle'"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiClosedCaptionOutline"
							v-if="isCaptionsSupported"
						>
							<div style="display: flex; justify-content: space-between">
								<span>{{ $t("room.subtitles") }}</span>
								<span
									v-if="
										captions.isCaptionsEnabled.value &&
										captions.currentTrack.value
									"
									style="color: #888"
								>
									{{ captions.currentTrack.value }}
								</span>
							</div>
						</v-list-item>
						<v-list-item
							link
							@click="currentMenu = 'quality'"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiTune"
							v-if="isQualitySupported"
						>
							<div style="display: flex; justify-content: space-between">
								<span>{{ $t("room.quality") }}</span>
								<!-- Show "Auto" if on auto quality, otherwise show current quality -->
								<span
									v-if="
										qualities.isAutoQualitySupported.value &&
										qualities.currentVideoTrack.value == -1
									"
									style="color: #888"
								>
									{{
										qualities.videoTracks.value.length > 0 &&
										qualities.currentActiveQuality.value !== null
											? `Auto (${
													qualities.videoTracks.value[
														qualities.currentActiveQuality.value
													]
											  }p)`
											: "Auto"
									}}
								</span>
								<span v-else style="color: #888">
									{{
										qualities.videoTracks.value[
											qualities.currentVideoTrack.value
										] + "p"
									}}
								</span>
							</div>
						</v-list-item>
					</v-list>
					<!-- Quality submenu -->
					<v-list
						v-else-if="currentMenu == 'quality'"
						key="quality"
						class="menu-content"
						color="primary"
					>
						<v-list-item
							link
							@click="currentMenu = 'main'"
							min-width="150px"
							:prepend-icon="mdiChevronLeft"
						>
							{{ $t("room.quality") }}
						</v-list-item>
						<v-list-item
							link
							@click="
								setVideosTrack(-1);
								closeMenu();
							"
							v-if="qualities.isAutoQualitySupported.value"
							:active="qualities.currentVideoTrack.value == -1"
						>
							{{
								qualities.currentVideoTrack.value == -1 &&
								qualities.videoTracks.value.length > 0 &&
								qualities.currentActiveQuality.value !== null
									? `Auto (${
											qualities.videoTracks.value[
												qualities.currentActiveQuality.value
											]
									  }p)`
									: "Auto"
							}}
						</v-list-item>
						<v-list-item
							link
							@click="
								setVideosTrack(idx);
								closeMenu();
							"
							v-for="(quality, idx) in qualities.videoTracks.value"
							:key="idx"
							:active="idx == qualities.currentVideoTrack.value"
						>
							{{ quality + "p" }}
						</v-list-item>
					</v-list>
					<!-- Subtitle/CC submenu -->
					<v-list
						v-else-if="currentMenu == 'subtitle'"
						key="subtitle"
						class="menu-content"
						color="primary"
					>
						<v-list-item
							link
							@click="currentMenu = 'main'"
							:prepend-icon="mdiChevronLeft"
							min-width="200px"
						>
							{{ $t("room.subtitles") }}
						</v-list-item>
						<v-list-item
							link
							@click="
								setCaptionsTrack(track);
								closeMenu();
							"
							v-for="(track, idx) in captions.captionsTracks.value"
							:key="idx"
							:active="
								captions.isCaptionsEnabled.value &&
								track == captions.currentTrack.value
							"
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

const qualities = useQualities();
const isQualitySupported = computed(
	() => qualities.isQualitySupported.value && qualities.videoTracks.value.length > 0
);

function setVideosTrack(idx: number) {
	qualities.currentVideoTrack.value = idx;
}

const captions = useCaptions();
const isCaptionsSupported = computed(
	() => captions.isCaptionsSupported.value && captions.captionsTracks.value.length > 0
);

function setCaptionsTrack(value: string) {
	if (!captions.isCaptionsEnabled.value) {
		captions.isCaptionsEnabled.value = true;
	}
	captions.currentTrack.value = value;
}

const currentMenu = ref<string>("main");
const isMenuSupported = computed(() => isQualitySupported.value || isCaptionsSupported.value);
const isMenuOpen = ref<boolean>(false);

function toggleMenu() {
	isMenuOpen.value = !isMenuOpen.value;
	if (!isMenuOpen.value) {
		currentMenu.value = "main";
	}
}

function closeMenu() {
	isMenuOpen.value = false;
	currentMenu.value = "main";
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
	// max-width: 320px;
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
