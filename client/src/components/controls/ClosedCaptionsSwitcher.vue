<template>
	<v-btn
		variant="text"
		icon
		:disabled="!supported"
		class="media-control"
		aria-label="Closed Captions"
	>
		<v-icon>mdi-closed-caption</v-icon>
		<v-menu location="top" offset-y activator="parent" :disabled="!supported">
			<v-list>
				<v-list-item
					link
					@click="setCaptionsEnabled(true)"
					v-if="captions.captionsTracks.value.length === 0"
					color="primary"
					variant="plain"
				>
					{{ $t("common.on") }}
				</v-list-item>
				<v-list-item
					link
					@click="setCaptionsTrack(track)"
					v-for="(track, idx) in captions.captionsTracks.value"
					:key="idx"
					:active="captions.isCaptionsEnabled.value && track == captions.currentTrack.value"
					color="primary"
					variant="plain"
					min-width="100px"
				>
					{{ track }}
				</v-list-item>
				<v-list-item
					link
					@click="setCaptionsEnabled(false)"
					:active="!captions.isCaptionsEnabled.value"
					color="primary"
					variant="plain"
				>
					{{ $t("common.off") }}
				</v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts" setup>
import { useCaptions } from "../composables";

const captions = useCaptions();

function setCaptionsEnabled(value: boolean) {
	captions.isCaptionsEnabled.value = value;
}

function setCaptionsTrack(value: string) {
	if (!captions.isCaptionsEnabled.value) {
		captions.isCaptionsEnabled.value = true;
	}
	captions.currentTrack.value = value;
}

const supported = captions.isCaptionsSupported;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
