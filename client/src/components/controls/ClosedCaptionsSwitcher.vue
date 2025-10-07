<template>
	<v-btn
		variant="text"
		icon
		v-if="supported"
		class="media-control"
		aria-label="Closed Captions"
		@click="toggleCaptions()"
	>
		<v-icon :icon="enabled ? mdiClosedCaption : mdiClosedCaptionOutline" />
		<v-tooltip activator="parent" location="bottom">
			{{ $t("room.subtitles") }}
		</v-tooltip>
	</v-btn>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { mdiClosedCaption, mdiClosedCaptionOutline } from "@mdi/js";
import { useCaptions } from "../composables";
import { useStore } from "@/store";

const store = useStore();
const captions = useCaptions();

const supported = computed(() => {
	// For YouTube, always enable caption switch, since its api doesn't return tracklist
	if (store.state.room.currentSource?.service === "youtube") {
		return true;
	}
	return captions.isCaptionsSupported.value && captions.captionsTracks.value.length > 0;
});
const enabled = computed(() => captions.isCaptionsEnabled.value);

function toggleCaptions() {
	captions.isCaptionsEnabled.value = !captions.isCaptionsEnabled.value;
}
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
