<template>
	<div class="player">
		<div class="in-player-notifs">
			<!-- TODO: replace with v-banner when this is fixed: https://github.com/vuetifyjs/vuetify/issues/17124 -->
			<v-sheet color="warning" density="compact" v-if="showBufferWarning">
				<v-container fluid style="padding: 6px">
					<div style="display: flex; align-items: center">
						<v-progress-circular indeterminate size="16" width="2" />
						<span>{{ $t("player.buffer-warn.spans", { ranges: renderedSpans }) }}</span>
						<v-spacer />
						<v-btn
							size="x-small"
							variant="text"
							icon
							@click="showBufferWarning = false"
						>
							<v-icon>mdi-close</v-icon>
						</v-btn>
					</div>
				</v-container>
			</v-sheet>
		</div>

		<Suspense>
			<YoutubePlayer
				v-if="!!source && source.service == 'youtube'"
				ref="player"
				:video-id="source.id"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
				@buffer-progress="onBufferProgress"
			/>
			<VimeoPlayer
				v-else-if="!!source && source.service == 'vimeo'"
				ref="player"
				:video-id="source.id"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
			/>
			<DailymotionPlayer
				v-else-if="!!source && source.service == 'dailymotion'"
				ref="player"
				:video-id="source.id"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
			/>
			<GoogleDrivePlayer
				v-else-if="!!source && source.service == 'googledrive'"
				ref="player"
				:video-id="source.id"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
			/>
			<PlyrPlayer
				v-else-if="
					!!source &&
					['direct', 'hls', 'dash', 'reddit', 'tubi', 'pluto'].includes(source.service)
				"
				ref="player"
				:service="source.service"
				:video-url="source.hls_url ?? source.id"
				:video-mime="source.mime!"
				:thumbnail="source.thumbnail"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
				@buffer-progress="onBufferProgress"
				@buffer-spans="onBufferSpans"
			/>
			<PeertubePlayer
				v-else-if="!!source && source.service == 'peertube'"
				ref="player"
				:video-id="source.id"
				class="player"
				@apiready="onApiReady"
				@playing="onPlaying"
				@paused="onPaused"
				@ready="onReady"
				@buffering="onBuffering"
				@error="onError"
			/>
			<v-container v-else fluid fill-height class="no-video">
				<h1>{{ $t("video.no-video") }}</h1>
				<span>{{ $t("video.no-video-text") }}</span>
			</v-container>
			<template #fallback>
				<v-container class="no-video">
					<v-progress-circular indeterminate />
				</v-container>
			</template>
		</Suspense>
	</div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { isInTimeRanges, secondsToTimestamp } from "@/util/timestamp";
import { PlayerStatus } from "ott-common/models/types";
import { QueueItem } from "ott-common/models/video";
import { calculateCurrentPosition } from "ott-common/timestamp";
import { defineComponent, defineAsyncComponent, PropType, ref, Ref, computed, watch } from "vue";
import { useCaptions, useMediaPlayer, usePlaybackRate, useVolume } from "../composables";
import { watchEffect } from "vue";

const services = [
	"youtube",
	"vimeo",
	"dailymotion",
	"googledrive",
	"direct",
	"reddit",
	"tubi",
	"peertube",
];

export interface MediaPlayer {
	/**
	 * Play the video.
	 *
	 * Some browsers emit promises for this, and some don't.
	 */
	play(): void | Promise<void>;
	/**
	 * Pause the video.
	 *
	 * Some browsers emit promises for this, and some don't.
	 */
	pause(): void | Promise<void>;
	setVolume(volume: number): void | Promise<void>;
	getPosition(): number;
	setPosition(position: number): void;

	isCaptionsSupported(): boolean;
	getAvailablePlaybackRates(): number[];
}

export interface MediaPlayerWithCaptions extends MediaPlayer {
	isCaptionsEnabled(): boolean;
	setCaptionsEnabled(enabled: boolean): void;
	getCaptionsTracks(): string[];
	setCaptionsTrack(track: string): void;
}

export interface MediaPlayerWithPlaybackRate extends MediaPlayer {
	getPlaybackRate(): number;
	setPlaybackRate(rate: number): void;
}

export default defineComponent({
	name: "OmniPlayer",
	props: {
		source: {
			type: Object as PropType<QueueItem | null>,
			validator: (source: QueueItem | null) => {
				return !source || services.includes(source.service);
			},
		},
	},
	emits: ["apiready", "playing", "paused", "ready", "buffering", "error"],
	components: {
		YoutubePlayer: defineAsyncComponent(() => import("./YoutubePlayer.vue")),
		VimeoPlayer: defineAsyncComponent(() => import("./VimeoPlayer.vue")),
		DailymotionPlayer: defineAsyncComponent(() => import("./DailymotionPlayer.vue")),
		GoogleDrivePlayer: defineAsyncComponent(() => import("./GoogleDrivePlayer.vue")),
		PlyrPlayer: defineAsyncComponent(() => import("./PlyrPlayer.vue")),
		PeertubePlayer: defineAsyncComponent(() => import("./PeertubePlayer.vue")),
	},
	setup(props, { emit }) {
		const store = useStore();

		const player: Ref<MediaPlayer | null> = ref(null);

		const controls = useMediaPlayer();

		function implementsCaptions(p: MediaPlayer | null): p is MediaPlayerWithCaptions {
			return !!p && p.isCaptionsSupported();
		}

		function implementsPlaybackRate(p: MediaPlayer | null): p is MediaPlayerWithPlaybackRate {
			return !!p && p.getAvailablePlaybackRates().length > 1;
		}

		const isPlayerPresent = computed(() => !!player.value);

		function isCaptionsSupported() {
			if (!controls.checkForPlayer(player.value)) {
				return false;
			}
			return implementsCaptions(player.value);
		}

		const volume = useVolume();
		const captions = useCaptions();
		watch(volume, v => {
			if (player.value) {
				player.value.setVolume(v);
			}
		});
		watch(player, v => {
			console.debug("Player changed", v);
			// note that we have to wait for the player's api to be ready before we can call any methods on it
			controls.setPlayer(v);
			controls.apiReady.value = false;
		});
		watch(captions.isCaptionsEnabled, v => {
			if (player.value && implementsCaptions(player.value)) {
				console.debug("Setting captions enabled", v);
				player.value.setCaptionsEnabled(v);
				captions.captionsTracks.value = player.value.getCaptionsTracks();
			}
		});
		watch(captions.currentTrack, v => {
			if (player.value && implementsCaptions(player.value) && v) {
				player.value.setCaptionsTrack(v);
			}
		});
		const playbackRate = usePlaybackRate();
		watch(playbackRate.isPlaybackRateSupported, v => {
			console.debug("Playback rate supported", v);
			if (!v || !player.value) {
				playbackRate.availablePlaybackRates.value = [1];
				playbackRate.playbackRate.value = 1;
			}
		});
		watch(playbackRate.playbackRate, v => {
			if (player.value && implementsPlaybackRate(player.value)) {
				player.value.setPlaybackRate(v);
			}
		});
		watchEffect(() => {
			playbackRate.playbackRate.value = store.state.room.playbackSpeed;
		});
		// player events re-emitted or data stored
		function onApiReady() {
			controls.apiReady.value = true;
			captions.isCaptionsSupported.value = isCaptionsSupported();
			playbackRate.isPlaybackRateSupported.value = implementsPlaybackRate(player.value);
			if (player.value) {
				player.value.setVolume(volume.value);
			}
			if (implementsCaptions(player.value)) {
				captions.captionsTracks.value = player.value.getCaptionsTracks();
			}
			if (implementsPlaybackRate(player.value)) {
				playbackRate.availablePlaybackRates.value =
					player.value.getAvailablePlaybackRates();
				player.value.setPlaybackRate(playbackRate.playbackRate.value);
			}
			emit("apiready");
		}

		function onReady() {
			store.commit("PLAYBACK_STATUS", PlayerStatus.ready);
			controls.apiReady.value = true;
			emit("ready");
		}

		function hackReadyEdgeCase() {
			if (
				props.source &&
				(props.source.service === "youtube" || props.source.service === "dailymotion")
			) {
				store.commit("PLAYBACK_STATUS", PlayerStatus.ready);
			}
		}

		function onPlaying() {
			hackReadyEdgeCase();
			controls.playing.value = true;
			emit("playing");
		}

		function onPaused() {
			hackReadyEdgeCase();
			controls.playing.value = false;
			emit("paused");
		}

		function onBuffering() {
			store.commit("PLAYBACK_STATUS", PlayerStatus.buffering);
			emit("buffering");
		}

		function onError() {
			store.commit("PLAYBACK_STATUS", PlayerStatus.error);
			emit("error");
		}

		function onBufferProgress(percent: number) {
			store.commit("PLAYBACK_BUFFER", percent);
		}

		async function onBufferSpans(spans: TimeRanges) {
			store.commit("PLAYBACK_BUFFER_SPANS", spans);

			const position = store.state.room.isPlaying
				? calculateCurrentPosition(
						store.state.room.playbackStartTime,
						new Date(),
						store.state.room.playbackPosition,
						store.state.room.playbackSpeed
				  )
				: store.state.room.playbackPosition;
			const isInSpans = isInTimeRanges(spans, position);
			showBufferWarning.value = !isInSpans;
		}

		const showBufferWarning = ref(false);
		const renderedSpans = computed(() => {
			const spans = store.state.playerBufferSpans;
			if (!spans) {
				return [];
			}
			let result: string = "";
			for (let i = 0; i < spans.length; i++) {
				result += `${secondsToTimestamp(spans.start(i))} - ${secondsToTimestamp(
					spans.end(i)
				)}`;
				if (i < spans.length - 1) {
					result += ", ";
				}
			}
			return result;
		});

		return {
			player,

			onApiReady,
			onReady,
			onPlaying,
			onPaused,
			onBuffering,
			onError,
			onBufferProgress,
			onBufferSpans,

			isPlayerPresent,
			showBufferWarning,
			renderedSpans,
			controls,
			playbackRate,
		};
	},
});
</script>

<style lang="scss" scoped>
.no-video {
	display: flex;
	height: 100%;
	align-items: center;
	flex-direction: column;
	justify-content: center;

	opacity: 60%;
	border-radius: 3px;
}

.v-theme--dark,
.v-theme--deepblue,
.v-theme--deepred {
	.no-video {
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.5);
	}
}

.v-theme--light {
	.no-video {
		color: #000;
		border: 1px solid rgba(0, 0, 0, 0.5);
	}
}

.player {
	width: 100%;
	height: 100%;
}

.in-player-notifs {
	display: block;
	width: 100%;
	padding: 0;
	position: absolute;
	top: 0;
	left: 0;
	font-size: 12px;
	z-index: 500;
}
</style>
