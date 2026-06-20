<template>
	<DropdownMenu>
		<DropdownMenuTrigger as-child>
			<Button
				variant="ghost"
				size="sm"
				class="media-control font-mono"
				:aria-label="$t('room.playback-speed')"
				:disabled="!supported"
			>
				{{ formatRate(playbackRate.playbackRate.value) }}
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="center" side="top">
			<DropdownMenuItem
				v-for="(rate, index) in playbackRate.availablePlaybackRates.value"
				:key="index"
				class="font-mono justify-center"
				@click="setRate(rate)"
			>
				{{ formatRate(rate) }}
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import { usePlaybackRate } from "../composables";

const connection = useConnection();
const roomApi = useRoomApi(connection);
const playbackRate = usePlaybackRate();

function formatRate(rate: number) {
	return `${rate.toLocaleString(undefined, {
		maximumFractionDigits: 2,
	})}x`;
}

function setRate(rate: number) {
	roomApi.setPlaybackRate(rate);
}

const supported = playbackRate.isPlaybackRateSupported;
</script>

<style scoped>
.media-control {
	color: var(--foreground);
}
</style>
