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
			<v-icon>fa:fas fa-angle-left</v-icon>
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
			<v-icon :icon="store.state.room.isPlaying ? 'fa:fas fa-pause' : 'fa:fas fa-play'" />
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
			<v-icon>fa:fas fa-angle-right</v-icon>
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
			<v-icon>fa:fas fa-fast-forward</v-icon>
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

<script lang="ts">
import { defineComponent } from "vue";
import _ from "lodash";
import { useStore } from "@/store";
import { granted } from "@/util/grants";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";

export const BasicControls = defineComponent({
	name: "BasicControls",
	props: {
		currentPosition: {
			type: Number,
			default: 0,
		},
	},
	emits: ["seek", "play", "pause", "skip"],
	setup(props, { emit }) {
		const store = useStore();
		const roomapi = useRoomApi(useConnection());

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
				_.clamp(
					props.currentPosition + delta,
					0,
					store.state.room.currentSource?.length ?? 0
				)
			);
			emit("seek");
		}

		function skip() {
			roomapi.skip();
			emit("skip");
		}

		return {
			store,
			roomapi,
			granted,

			togglePlayback,
			seekDelta,
			skip,
		};
	},
});

export default BasicControls;
</script>

<style lang="scss">
@use "./media-controls.scss";

.vote-skip {
	position: absolute;
	top: -100%;
}
</style>
