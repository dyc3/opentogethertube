<template>
	<v-btn class="media-control" aria-label="Playback Speed">
		{{ formatRate(currentRate) }}

		<v-menu activator="parent">
			<v-list>
				<v-list-item v-for="(rate, index) in availableRates" :key="index" :value="index">
					<v-list-item-title>{{ formatRate(rate) }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";

const PlaybackRateSwitcher = defineComponent({
	name: "PlaybackRateSwitcher",
	props: {
		currentRate: {
			type: Number,
			required: true,
		},
		availableRates: {
			type: Array as PropType<number[]>,
			required: true,
		},
	},
	setup(props) {
		if (props.availableRates.length === 0) {
			throw new Error("PlaybackRateSwitcher: availableRates must be a non-empty array.");
		}

		const connection = useConnection();
		const roomApi = useRoomApi(connection);

		function formatRate(rate: number) {
			return (
				rate.toLocaleString(undefined, {
					maximumFractionDigits: 2,
				}) + "x"
			);
		}

		return {
			formatRate,
		};
	},
});

export default PlaybackRateSwitcher;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
