<template>
	<DropdownMenu>
		<Tooltip>
			<TooltipTrigger as-child>
				<DropdownMenuTrigger as-child>
					<Button
						variant="ghost"
						size="sm"
						class="media-control font-mono"
						aria-label="Playback Speed"
						:disabled="!supported"
					>
						{{ formatRate(playbackRate.playbackRate.value) }}
					</Button>
				</DropdownMenuTrigger>
			</TooltipTrigger>
			<TooltipContent side="bottom">{{ $t("room.playback-speed") }}</TooltipContent>
		</Tooltip>
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
