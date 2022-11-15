<template>
	<div>
		<v-btn variant="text" icon @click="seekDelta(-10)" :disabled="!granted('playback.seek')">
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
		>
			<v-icon :icon="store.state.room.isPlaying ? 'fa:fas fa-pause' : 'fa:fas fa-play'" />
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.play-pause") }}</span>
			</v-tooltip>
		</v-btn>
		<v-btn variant="text" icon @click="seekDelta(10)" :disabled="!granted('playback.seek')">
			<v-icon>fa:fas fa-angle-right</v-icon>
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.skip") }}</span>
			</v-tooltip>
		</v-btn>
		<v-btn variant="text" icon @click="api.skip()" :disabled="!granted('playback.skip')">
			<v-icon>fa:fas fa-fast-forward</v-icon>
			<v-tooltip activator="parent" location="bottom">
				<span>{{ $t("room.next-video") }}</span>
			</v-tooltip>
		</v-btn>
	</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import _ from "lodash";
import { useStore } from "@/store";
import api from "@/util/api";
import { granted } from "@/util/grants";

export const BasicControls = defineComponent({
	name: "BasicControls",
	props: {
		currentPosition: {
			type: Number,
			default: 0,
		},
	},
	setup(props) {
		const store = useStore();

		/** Send a message to play or pause the video, depending on the current state. */
		function togglePlayback() {
			if (store.state.room.isPlaying) {
				api.pause();
			} else {
				api.play();
			}
		}

		function seekDelta(delta: number) {
			api.seek(
				_.clamp(
					props.currentPosition + delta,
					0,
					store.state.room.currentSource?.length ?? 0
				)
			);
		}

		return {
			store,
			api,
			granted,

			togglePlayback,
			seekDelta,
		};
	},
});

export default BasicControls;
</script>
