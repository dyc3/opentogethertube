<template>
	<iframe class="peertube" id="peertube-player" :src="peertubeUrl"></iframe>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted } from "vue";
import { PeerTubePlayer as Peertube } from "@peertube/embed-api";

// CURRENTLY SOMEWHAT BROKEN
// does not respect position syncing for some reason.

const PeertubePlayer = defineComponent({
	name: "PeertubePlayer",
	props: {
		videoId: { type: String, required: true },
	},
	emits: ["playing", "paused", "ready", "buffering", "error", "apiready"],
	setup(props, { emit }) {
		let player: Peertube | undefined = undefined;

		const videoId = computed(() => props.videoId.split(":"));
		const peertubeHost = computed(() => videoId.value[0]);
		const peertubeId = computed(() => videoId.value[1]);
		const peertubeUrl = computed(
			() => `https://${peertubeHost.value}/videos/embed/${peertubeId.value}?controls=0&api=1`
		);

		onMounted(async () => {
			const container = document.getElementById("peertube-player");
			if (!container) {
				return;
			}

			player = new Peertube(container);
			await player.ready;
			player.addEventListener("playbackStatusChange", onPlaybackStatusChange);
			emit("apiready");
			emit("ready");
		});

		function onPlaybackStatusChange(status: "playing" | "paused") {
			if (status === "playing") {
				emit("playing");
			} else if (status === "paused") {
				emit("paused");
			}
		}

		async function play(): Promise<void> {
			if (!player) {
				return;
			}
			return await player.play();
		}
		async function pause(): Promise<void> {
			if (!player) {
				return;
			}
			return await player.pause();
		}
		async function getPosition(): Promise<number> {
			if (!player) {
				return 0;
			}
			return player.getCurrentPosition();
		}
		function setPosition(position: number) {
			if (!player) {
				return;
			}
			return player.seek(position);
		}
		function setVolume(value: number) {
			if (!player) {
				return;
			}
			return player.setVolume(value / 100);
		}
		function isCaptionsSupported(): boolean {
			return false;
		}

		function getAvailablePlaybackRates(): number[] {
			return player.getPlaybackRates();
		}

		async function getPlaybackRate(): Promise<number> {
			return await player.getPlaybackRate();
		}

		async function setPlaybackRate(rate: number): Promise<void> {
			await player.setPlaybackRate(rate);
		}

		return {
			peertubeUrl,

			play,
			pause,
			getPosition,
			setPosition,
			setVolume,
			isCaptionsSupported,
			getAvailablePlaybackRates,
			getPlaybackRate,
			setPlaybackRate,
		};
	},
});

export default PeertubePlayer;
</script>

<style lang="scss" scoped>
.vimeo {
	color: #696969;
}
</style>
