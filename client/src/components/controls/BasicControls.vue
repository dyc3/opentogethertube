<template>
	<div class="flex items-center">
		<Tooltip>
			<TooltipTrigger as-child>
				<Button
					variant="ghost"
					size="icon"
					class="media-control"
					:disabled="!granted('playback.seek')"
					:aria-label="$t('room.rewind')"
					@click="seekDelta(-10)"
				>
					<Icon :icon="mdiChevronLeft" class="size-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{{ $t("room.rewind") }}</TooltipContent>
		</Tooltip>
		<Tooltip>
			<TooltipTrigger as-child>
				<Button
					variant="ghost"
					size="icon"
					class="media-control"
					:disabled="!granted('playback.play-pause')"
					:aria-label="$t('room.play-pause')"
					@click="togglePlayback()"
				>
					<Icon :icon="store.state.room.isPlaying ? mdiPause : mdiPlay" class="size-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{{ $t("room.play-pause") }}</TooltipContent>
		</Tooltip>
		<Tooltip>
			<TooltipTrigger as-child>
				<Button
					variant="ghost"
					size="icon"
					class="media-control"
					:disabled="!granted('playback.seek')"
					:aria-label="$t('room.skip')"
					@click="seekDelta(10)"
				>
					<Icon :icon="mdiChevronRight" class="size-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{{ $t("room.skip") }}</TooltipContent>
		</Tooltip>
		<Tooltip>
			<TooltipTrigger as-child>
				<Button
					variant="ghost"
					size="icon"
					class="media-control"
					:disabled="!granted('playback.skip')"
					:aria-label="
						store.state.room.enableVoteSkip
							? $t('room.next-video-vote')
							: $t('room.next-video')
					"
					@click="skip()"
				>
					<Icon :icon="mdiSkipForward" class="size-5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{{
					store.state.room.enableVoteSkip
						? $t("room.next-video-vote")
						: $t("room.next-video")
				}}
			</TooltipContent>
		</Tooltip>
	</div>
</template>

<script lang="ts" setup>
import { mdiChevronLeft, mdiPlay, mdiPause, mdiChevronRight, mdiSkipForward } from "@mdi/js";
import _ from "lodash";
import { onMounted, onUnmounted } from "vue";
import { useStore } from "@/store";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import { useGrants } from "../composables/grants";

const props = withDefaults(
	defineProps<{
		currentPosition: number;
	}>(),
	{
		currentPosition: 0,
	},
);

const emit = defineEmits(["seek", "play", "pause", "skip"]);

const store = useStore();
const roomapi = useRoomApi(useConnection());
const granted = useGrants();

// Setup Media Session API handlers for the controls in PiP
onMounted(() => {
	if ("mediaSession" in navigator) {
		navigator.mediaSession.setActionHandler("play", () => {
			if (granted("playback.play-pause")) {
				togglePlayback();
			}
		});

		navigator.mediaSession.setActionHandler("pause", () => {
			if (granted("playback.play-pause")) {
				togglePlayback();
			}
		});

		navigator.mediaSession.setActionHandler("nexttrack", () => {
			if (granted("playback.skip")) {
				skip();
			}
		});
	}
});

onUnmounted(() => {
	if ("mediaSession" in navigator) {
		navigator.mediaSession.setActionHandler("play", null);
		navigator.mediaSession.setActionHandler("pause", null);
		navigator.mediaSession.setActionHandler("nexttrack", null);
	}
});

/** Send a message to play or pause the video, depending on the current state. */
function togglePlayback() {
	if (store.state.room.isPlaying) {
		roomapi.pause();
		emit("pause");
	} else {
		roomapi.play();
		emit("play");
	}
}

function seekDelta(delta: number) {
	roomapi.seek(
		_.clamp(props.currentPosition + delta, 0, store.state.room.currentSource?.length ?? 0),
	);
	emit("seek");
}

function skip() {
	roomapi.skip();
	emit("skip");
}
</script>

<style scoped>
.media-control {
	color: var(--foreground);
}
</style>
