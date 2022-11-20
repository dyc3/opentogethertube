<template>
	<v-btn variant="text" icon :disabled="!supported">
		<v-icon>fa:fas fa-closed-captioning</v-icon>
		<v-menu location="top" offset-y activator="parent" :disabled="!supported">
			<v-list>
				<v-list-item link @click="setCaptionsEnabled(true)" v-if="tracks.length === 0">
					On
				</v-list-item>
				<v-list-item
					link
					@click="setCaptionsTrack(track)"
					v-for="(track, idx) in tracks"
					:key="idx"
				>
					{{ track }}
				</v-list-item>
				<v-list-item link @click="setCaptionsEnabled(false)"> Off </v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";

const ClosedCaptionsSwitcher = defineComponent({
	name: "ClosedCaptionsSwitcher",
	emits: ["enable-cc", "cc-track"],
	props: {
		supported: { type: Boolean, default: true },
		tracks: { type: Array as PropType<string[]>, default: () => [] },
	},
	setup(props, { emit }) {
		function setCaptionsEnabled(value: boolean) {
			emit("enable-cc", value);
		}

		function setCaptionsTrack(value: string) {
			emit("cc-track", value);
		}

		return {
			setCaptionsEnabled,
			setCaptionsTrack,
		};
	},
});

export default ClosedCaptionsSwitcher;
</script>
