<template>
	<v-menu top offset-y :disabled="!supported">
		<template v-slot:activator="{ on, attrs }">
			<v-btn v-bind="attrs" v-on="on" :disabled="!supported">
				<v-icon>fas fa-closed-captioning</v-icon>
			</v-btn>
		</template>
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
</template>

<script lang="ts">
import { defineComponent, toRefs } from "@vue/composition-api";

interface ClosedCaptionsSwitcherProps {
	supported: boolean;
	tracks: string[];
}

const ClosedCaptionsSwitcher = defineComponent({
	name: "ClosedCaptionsSwitcher",
	emits: ["enable-cc", "cc-track"],
	props: {
		supported: { type: Boolean, default: true },
		tracks: { type: Array, default: [] },
	},
	setup(props: ClosedCaptionsSwitcherProps, { emit }) {
		let { tracks } = toRefs(props);

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
