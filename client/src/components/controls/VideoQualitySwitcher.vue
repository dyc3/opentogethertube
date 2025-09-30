<template>
	<v-btn
		variant="text"
		icon
		:disabled="!supported"
		class="media-control"
		:aria-label="$t('room.video-quality')"
	>
		<v-icon>mdi-settings</v-icon>
		<v-menu location="top" offset-y activator="parent" :disabled="!supported">
			<v-list>
				<v-list-item
					link
					@click="setVideosTrack(-1)"
					v-if="qualities.isAutoQualitySupported"
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
		</v-menu>
	</v-btn>
</template>

<script lang="ts" setup>
import { useQualities } from "../composables";

const qualities = useQualities();

function setVideosTrack(idx: number) {
	qualities.currentVideoTrack.value = idx;
}

const supported = qualities.isQualitySupported;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
