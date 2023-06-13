<template>
	<v-btn variant="text" class="media-control" aria-label="Playback Speed" :disabled="!supported">
		{{ formatRate(currentRate) }}

		<v-menu location="top" activator="parent">
			<v-list>
				<v-list-item
					v-for="(rate, index) in availableRates"
					:key="index"
					:value="index"
					@click="setRate(rate)"
				>
					<v-list-item-title>{{ formatRate(rate) }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts">
import { defineComponent, PropType, computed } from "vue";
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

		function setRate(rate: number) {
			roomApi.setPlaybackRate(rate);
		}

		const supported = computed(() => {
			return props.availableRates.length > 1;
		});

		return {
			formatRate,
			supported,
			setRate,
		};
	},
});

export default PlaybackRateSwitcher;
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
