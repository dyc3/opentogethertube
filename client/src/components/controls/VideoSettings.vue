<template>
	<v-btn
		variant="text"
		icon
		class="media-control"
		:aria-label="$t('room.player-settings')"
		:disabled="!isMenuSupported"
	>
		<v-icon :icon="mdiCog" />
		<v-tooltip activator="parent" location="bottom">
			{{ $t("room.player-settings") }}
		</v-tooltip>
		<v-menu
			location="top"
			offset-y
			activator="parent"
			:close-on-content-click="false"
			@update:model-value="onMenuToggle"
		>
			<div class="menu-container">
				<transition name="menu-resize" mode="out-in">
					<!-- Main menu -->
					<v-list v-if="currentMenu == 'main'" key="main" class="menu-content">
						<v-list-item
							link
							@click="currentMenu = 'subtitle'"
							color="primary"
							variant="plain"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiClosedCaptionOutline"
							v-if="isCaptionsSupported"
						>
							{{ $t("room.subtitles") }}
						</v-list-item>
						<v-list-item
							link
							@click="currentMenu = 'quality'"
							color="primary"
							variant="plain"
							:append-icon="mdiChevronRight"
							:prepend-icon="mdiTune"
							v-if="isQualitySupported"
						>
							{{ $t("room.quality") }}
						</v-list-item>
					</v-list>
					<!-- Quality submenu -->
					<v-list v-else-if="currentMenu == 'quality'" key="quality" class="menu-content">
						<v-list-item
							link
							@click="currentMenu = 'main'"
							color="primary"
							variant="plain"
							min-width="100px"
							:prepend-icon="mdiChevronLeft"
						>
							{{ $t("room.back") }}
						</v-list-item>
						<v-list-item
							link
							@click="setVideosTrack(-1)"
							v-if="qualities.isAutoQualitySupported.value"
							:active="qualities.currentVideoTrack.value == -1"
							color="primary"
							variant="plain"
							min-width="100px"
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
							@click="setVideosTrack(idx)"
							v-for="(quality, idx) in qualities.videoTracks.value"
							:key="idx"
							:active="idx == qualities.currentVideoTrack.value"
							color="primary"
							variant="plain"
							min-width="100px"
						>
							{{ quality + "p" }}
						</v-list-item>
					</v-list>
					<!-- Subtitle/CC submenu -->
					<v-list
						v-else-if="currentMenu == 'subtitle'"
						key="subtitle"
						class="menu-content"
					>
						<v-list-item
							link
							@click="currentMenu = 'main'"
							color="primary"
							variant="plain"
							min-width="100px"
							:prepend-icon="mdiChevronLeft"
						>
							{{ $t("room.back") }}
						</v-list-item>
						<v-list-item
							link
							@click="setCaptionsTrack(track)"
							v-for="(track, idx) in captions.captionsTracks.value"
							:key="idx"
							:active="
								captions.isCaptionsEnabled.value &&
								track == captions.currentTrack.value
							"
							color="primary"
							variant="plain"
							min-width="100px"
						>
							{{ track }}
						</v-list-item>
					</v-list>
				</transition>
			</div>
		</v-menu>
	</v-btn>
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

// Reset to main menu when closing
function onMenuToggle(isOpen: boolean) {
	if (!isOpen) {
		currentMenu.value = "main";
	}
}
</script>

<style lang="scss">
@use "./media-controls.scss";

.menu-container {
	position: relative;
	overflow: hidden;
	transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
	min-width: 120px;
	width: auto;
	border-radius: 8px;
}

.menu-content {
	width: 100%;
	min-height: fit-content;
}

.menu-resize-enter-active,
.menu-resize-leave-active {
	transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
	overflow: hidden;
}

.menu-resize-enter-from,
.menu-resize-leave-to {
	opacity: 0;
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
