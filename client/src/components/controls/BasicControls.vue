<template>
	<div>
		<v-btn
			variant="text"
			icon
			@click="seekDelta(-10)"
			:disabled="!granted('playback.seek')"
			class="media-control"
			:aria-label="$t('room.rewind')"
		>
			<v-icon>mdi-chevron-left</v-icon>
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.rewind") }}</span>
			</v-tooltip>
		</v-btn>
		<v-btn
			variant="text"
			icon
			@click="togglePlayback()"
			:disabled="!granted('playback.play-pause')"
			class="media-control"
			:aria-label="$t('room.play-pause')"
		>
			<v-icon :icon="store.state.room.isPlaying ? 'mdi-pause' : 'mdi-play'" />
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.play-pause") }}</span>
			</v-tooltip>
		</v-btn>
		<v-btn
			variant="text"
			icon
			@click="seekDelta(10)"
			:disabled="!granted('playback.seek')"
			class="media-control"
			:aria-label="$t('room.skip')"
		>
			<v-icon>mdi-chevron-right</v-icon>
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.skip") }}</span>
			</v-tooltip>
		</v-btn>
		<v-btn
			variant="text"
			icon
			@click="skip()"
			:disabled="!granted('playback.skip')"
			class="media-control"
			:aria-label="
				store.state.room.enableVoteSkip ? $t('room.next-video-vote') : $t('room.next-video')
			"
		>
			<v-icon>mdi-skip-forward</v-icon>
			<v-tooltip activator="parent" location="bottom">
				<span>
					{{
						store.state.room.enableVoteSkip
							? $t("room.next-video-vote")
							: $t("room.next-video")
					}}
				</span>
			</v-tooltip>
		</v-btn>
	</div>
</template>

<script lang="ts" setup>
import _ from "lodash";
import { useConnection } from "@/plugins/connection";
import { useStore } from "@/store";
import { useRoomApi } from "@/util/roomapi";
import { useGrants } from "../composables/grants";

const props = withDefaults(
	defineProps<{
		currentPosition: number;
	}>(),
	{
		currentPosition: 0,
	}
);

const emit = defineEmits(["seek", "play", "pause", "skip"]);

const store = useStore();
const roomapi = useRoomApi(useConnection());
const granted = useGrants();

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
		_.clamp(props.currentPosition + delta, 0, store.state.room.currentSource?.length ?? 0)
	);
	emit("seek");
}

function skip() {
	roomapi.skip();
	emit("skip");
}
</script>

<style lang="scss">
@use "./media-controls.scss";
</style>
