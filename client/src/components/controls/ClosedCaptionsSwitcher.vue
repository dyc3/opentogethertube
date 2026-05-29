<template>
	<Tooltip>
		<TooltipTrigger as-child>
			<Button
				variant="ghost"
				size="icon"
				class="media-control"
				aria-label="Closed Captions"
				:disabled="!supported"
				@click="toggleCaptions()"
			>
				<Icon
					:icon="enabled ? mdiClosedCaption : mdiClosedCaptionOutline"
					class="size-5"
				/>
			</Button>
		</TooltipTrigger>
		<TooltipContent side="bottom">{{ $t("room.subtitles") }}</TooltipContent>
	</Tooltip>
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

<style scoped>
.media-control {
	color: var(--foreground);
}
</style>
