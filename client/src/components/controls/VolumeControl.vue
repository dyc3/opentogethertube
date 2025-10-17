<template>
	<v-icon :icon="volumeIcon" @click="toggleMute" />
	<div class="volume">
		<vue-slider
			:model-value="volume.volume.value"
			@update:model-value="changed"
			:tooltip-placement="'bottom'"
			:tooltip="'hover'"
			:process="
				dotsPos => [
					[
						0,
						dotsPos[0],
						{
							backgroundColor: 'rgb(var(--v-theme-primary))',
						},
					],
				]
			"
			:drag-on-click="true"
			data-cy="volume-slider"
		/>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/default.css";
import { useVolume } from "../composables";
import { mdiVolumeHigh, mdiVolumeMedium, mdiVolumeLow, mdiVolumeOff } from "@mdi/js";

const emit = defineEmits(["update:volume"]);

const volume = useVolume();
const volumeIcon = computed(() => {
	const volumeLevel = volume.volume.value;
	if (volume.isMuted.value || volumeLevel === 0) {
		return mdiVolumeOff;
	}

	if (volumeLevel >= 66) {
		return mdiVolumeHigh;
	} else if (volumeLevel >= 33) {
		return mdiVolumeMedium;
	} else {
		return mdiVolumeLow;
	}
});

function changed(value: number) {
	emit("update:volume", value);
	volume.volume.value = value;
}

function toggleMute() {
	volume.isMuted.value = !volume.isMuted.value;
}
</script>

<style lang="scss" scoped>
@use "../../variables.scss";

.volume {
	width: 150px;
	margin-left: 10px;
	margin-right: 20px;

	@media (max-width: variables.$md-max) {
		width: 100px;
	}
}
</style>
