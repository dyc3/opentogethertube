<template>
	<vue-slider
		:model-value="volume"
		@update:model-value="changed"
		style="width: 150px; margin-left: 10px; margin-right: 20px"
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
</template>

<script lang="ts" setup>
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/default.css";
import { useVolume } from "../composables";

const emit = defineEmits(["update:volume"]);

const volume = useVolume();

function changed(value: number) {
	emit("update:volume", value);
	volume.value = value;
}
</script>
