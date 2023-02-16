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
	/>
</template>

<script lang="ts">
import { defineComponent, inject, ref } from "vue";
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/default.css";
import { VOLUME_KEY } from "./controlkeys";

export default defineComponent({
	name: "VolumeControl",
	components: {
		VueSlider,
	},
	emits: ["update:volume"],
	setup(props, { emit }) {
		// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
		const [volume, updateVolume] = inject(VOLUME_KEY, [ref(100), (_: number) => {}]);

		function changed(value: number) {
			emit("update:volume", value);
			updateVolume(value);
		}

		return { volume, changed };
	},
});
</script>
