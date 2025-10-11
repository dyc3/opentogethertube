<template>
	<v-btn variant="text" class="media-control" aria-label="Playback Speed" :disabled="!supported">
		{{ formatRate(playbackRate.playbackRate.value) }}

		<v-tooltip activator="parent" location="bottom">
			<span>{{ $t("room.playback-speed") }}</span>
		</v-tooltip>
		<v-menu location="top" activator="parent" offset="+30px">
			<v-list class="playback-rate-menu">
				<v-list-item
					v-for="(rate, index) in playbackRate.availablePlaybackRates.value"
					:key="index"
					:value="rate"
					@click="setRate(rate)"
				>
					<v-list-item-title>{{ formatRate(rate) }}</v-list-item-title>
				</v-list-item>
			</v-list>
		</v-menu>
	</v-btn>
</template>

<script lang="ts" setup>
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import { usePlaybackRate } from "../composables";

const connection = useConnection();
const roomApi = useRoomApi(connection);
const playbackRate = usePlaybackRate();

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

const supported = playbackRate.isPlaybackRateSupported;
</script>

<style lang="scss">
@use "./media-controls.scss";

.playback-rate-menu {
	background-color: media-controls.$menu-background !important;
	border-radius: media-controls.$menu-radius !important;
}
</style>
