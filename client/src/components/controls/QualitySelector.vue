<template>
	<v-btn variant="text" class="media-control" aria-label="Video Quality" :disabled="!supported">
		{{ currentQuality.label }}

		<v-menu location="top" activator="parent">
			<v-list density="compact">
				<v-list-item
					v-for="(quality, index) in availableQualities"
					:key="index"
					@click="setQuality(quality)"
				>
					<v-list-item-title>{{ quality.label }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts">
import { defineComponent, PropType, computed } from "vue";
import { QUALITY_AUTO, QualityLevel } from "../players/OmniPlayer.vue";

const QualitySelector = defineComponent({
	name: "QualitySelector",
	props: {
		currentQuality: {
			type: Object as PropType<QualityLevel>,
			required: true,
			default: QUALITY_AUTO,
		},
		availableQualities: {
			type: Array as PropType<QualityLevel[]>,
			required: true,
		},
	},
	emits: ["set-quality"],
	setup(props, { emit }) {
		const supported = computed(() => {
			return props.availableQualities.length > 0;
		});

		function setQuality(quality: QualityLevel) {
			emit("set-quality", quality);
		}

		return {
			supported,
			setQuality,
		};
	},
});

export default QualitySelector;
</script>
