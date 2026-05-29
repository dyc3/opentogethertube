<template>
	<div class="flex items-center">
		<Button
			variant="ghost"
			size="icon"
			class="media-control"
			aria-label="Mute"
			@click="toggleMute"
		>
			<Icon :icon="volumeIcon" class="size-5" />
		</Button>
		<div class="volume">
			<Slider
				:model-value="[volume.volume.value]"
				:min="0"
				:max="100"
				:step="1"
				data-cy="volume-slider"
				@update:model-value="v => changed(v?.[0] ?? 0)"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
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

<style scoped>
.media-control {
	color: var(--foreground);
}

.volume {
	width: 150px;
	margin-left: 10px;
	margin-right: 20px;
}

@media (max-width: 960px) {
	.volume {
		width: 100px;
	}
}
</style>
