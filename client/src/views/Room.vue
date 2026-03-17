<template>
	<div :style="isControlsOnlyMode ? 'background: transparent;' : ''">
		<!-- HACK: For some reason, safari really doesn't like typescript enums. As a result, we are forced to not use the enums, and use their literal values instead. -->

		<!-- CONTROLS-ONLY MODE: Just the controls for separate iframe -->
		<div v-if="isControlsOnlyMode && !showDisconnectedOverlay" class="controls-only-container">
			<VideoControls
				v-if="shouldShowControls"
				:slider-position="sliderPosition"
				:true-position="truePosition"
				:controls-visible="true"
				:key="currentSource?.id"
				mode="outside-video"
				:is-projection-mode="isProjectionMode"
				:is-projectionist="isProjectionist"
			/>
		</div>

		<!-- EMBED MODE: Minimal video player only -->
		<div v-else-if="isEmbedMode && !showDisconnectedOverlay" class="embed-container">
			<div class="video-container" :class="{ 'projection-mode': isProjectionMode }">
				<div class="video-subcontainer">
					<div class="player-container" ref="playerContainer">
						<OmniPlayer
							:source="store.state.room.currentSource"
							@apiready="onPlayerApiReady"
							@playing="onPlaybackChange(true)"
							@paused="onPlaybackChange(false)"
							@ready="onPlayerReady"
						/>
						<div id="mouse-event-swallower" :class="{ hide: controlsVisible }" @click="shouldShowControls ? togglePlayback() : null"></div>
						<div class="playback-blocked-prompt" v-if="mediaPlaybackBlocked">
							<v-btn
								:prepend-icon="mdiPlay"
								size="x-large"
								color="warning"
								@click="onClickUnblockPlayback"
							>
								{{ $t("common.play") }}
							</v-btn>
						</div>
						<!-- Audience Play Button for Projection Mode -->
						<AudiencePlayButton
							:is-projection-mode="isProjectionMode"
							:is-projectionist="isProjectionist"
						/>
					</div>
					<VideoControls
						v-if="shouldShowControls"
						:slider-position="sliderPosition"
						:true-position="truePosition"
						:controls-visible="controlsVisible"
						:key="currentSource?.id"
						:mode="controlsMode"
						:is-projection-mode="isProjectionMode"
						:is-projectionist="isProjectionist"
					/>
				</div>
			</div>
		</div>

		<!-- NORMAL MODE: Full room interface -->
		<v-container
			v-else-if="!showDisconnectedOverlay"
			fluid
			:class="{
				'room': true,
				'fullscreen': store.state.fullscreen,
				'layout-default': store.state.settings.roomLayout === 'default',
				'layout-theater': store.state.settings.roomLayout === 'theater',
			}"
		>
			<div class="room-header" v-if="!store.state.fullscreen">
				<h1 class="room-title">
					{{
						store.state.room.title !== ""
							? store.state.room.title
							: store.state.room.isTemporary
							? $t("room.title-temp")
							: store.state.room.name
					}}
				</h1>
				<ClientSettingsDialog />
				<div class="grow"><!-- Spacer --></div>
				<span id="connectStatus">{{ connectionStatus }}</span>
			</div>
			<div class="video-container" :class="{ 'projection-mode': isProjectionMode }">
				<div class="video-subcontainer">
					<div class="player-container" ref="playerContainer">
						<OmniPlayer
							:source="store.state.room.currentSource"
							@apiready="onPlayerApiReady"
							@playing="onPlaybackChange(true)"
							@paused="onPlaybackChange(false)"
							@ready="onPlayerReady"
						/>
						<div id="mouse-event-swallower" :class="{ hide: controlsVisible }" @click="shouldShowControls ? togglePlayback() : null"></div>
						<div class="in-video-chat" v-if="controlsMode === 'in-video'">
							<Chat ref="chat" @link-click="setAddPreviewText" />
						</div>
						<div class="playback-blocked-prompt" v-if="mediaPlaybackBlocked">
							<v-btn
								:prepend-icon="mdiPlay"
								size="x-large"
								color="warning"
								@click="onClickUnblockPlayback"
							>
								{{ $t("common.play") }}
							</v-btn>
						</div>
						<!-- Audience Play Button for Projection Mode -->
						<AudiencePlayButton
							:is-projection-mode="isProjectionMode"
							:is-projectionist="isProjectionist"
						/>
					</div>
					<VideoControls
						v-if="shouldShowControls"
						:slider-position="sliderPosition"
						:true-position="truePosition"
						:controls-visible="controlsVisible"
						:key="currentSource?.id"
						:mode="controlsMode"
						:is-projection-mode="isProjectionMode"
						:is-projectionist="isProjectionist"
					/>
				</div>
				<div
					class="out-video-chat"
					v-if="controlsMode === 'outside-video' && !store.state.fullscreen"
				>
					<Chat ref="chat" @link-click="setAddPreviewText" />
				</div>
			</div>
			<div class="banners">
				<RestoreQueue />
				<VoteSkip />
			</div>
			<div class="under-video-grid">
				<div class="under-video-tabs">
					<v-tabs fixed-tabs v-model="queueTab" color="primary">
						<v-tab>
							<v-icon :icon="mdiFormatListBulleted" />
							<span class="tab-text">{{ $t("room.tabs.queue") }}</span>
							<v-chip size="x-small">
								{{
									store.state.room.queue.length <= 99
										? $n(store.state.room.queue.length)
										: "99+"
								}}
							</v-chip>
						</v-tab>
						<v-tab>
							<v-icon :icon="mdiPlus" />
							<span class="tab-text">{{ $t("common.add") }}</span>
						</v-tab>
						<v-tab>
							<v-icon :icon="mdiWrench" />
							<span class="tab-text">{{ $t("room.tabs.settings") }}</span>
						</v-tab>
					</v-tabs>
					<v-window v-model="queueTab" class="queue-tab-content">
						<v-window-item>
							<VideoQueue @switchtab="queueTab = 1" />
						</v-window-item>
						<v-window-item>
							<AddPreview ref="addpreview" />
						</v-window-item>
						<v-window-item>
							<RoomSettingsForm ref="settings" />
						</v-window-item>
					</v-window>
				</div>
				<div class="user-invite-container">
					<div v-if="debugMode" class="debug-container">
						<v-card>
							<v-card-title> Debug (prod: {{ production }}) </v-card-title>
							<v-list-item>
								Player status: {{ store.state.playerStatus }}
							</v-list-item>
							<v-list-item v-if="store.state.playerBufferPercent">
								Buffered:
								{{ Math.round(store.state.playerBufferPercent * 10000) / 100 }}%
							</v-list-item>
							<v-list-item
								v-if="
									store.state.playerBufferSpans &&
									store.state.playerBufferSpans.length > 0
								"
							>
								Buffered spans:
								{{ store.state.playerBufferSpans.length }}
								{{
									Array.from(
										{ length: store.state.playerBufferSpans.length },
										(v, k) => k++
									)
										.map(
											i =>
												`${i}: [${secondsToTimestamp(
													store.state.playerBufferSpans?.start(i) ?? 0
												)} => ${secondsToTimestamp(
													store.state.playerBufferSpans?.end(i) ?? 0
												)}]`
										)
										.join(" ")
								}}
							</v-list-item>
							<v-list-item>
								<span>Is Mobile: {{ isMobile }}</span>
							</v-list-item>
							<v-list-item>
								<span>Device Orientation: {{ orientation }}</span>
							</v-list-item>
							<v-list-item>
								<span>
									Video controls: timeoutId:
									{{ videoControlsHideTimeout }} visible:
									{{ controlsVisible }}
								</span>
							</v-list-item>
							<v-list-item>
								<v-btn @click="roomapi.kickMe()" :disabled="!isConnected">
									{{ $t("room.kick-me") }}
								</v-btn>
								<v-btn @click="roomapi.kickMe(1000)" :disabled="!isConnected">
									Disconnect Me
								</v-btn>
							</v-list-item>
						</v-card>
					</div>
					<UserList :users="Array.from(store.state.users.users.values())" />
					<ShareInvite />
				</div>
			</div>
		</v-container>
		<v-footer v-if="!isEmbedMode">
			<v-container>
				<v-row class="center-shit">
					<router-link to="/privacypolicy" v-if="isOfficialSite()">
						{{ $t("footer.privacy-policy") }}
					</router-link>
				</v-row>
				<v-row class="center-shit">
					{{ gitCommit }}
				</v-row>
			</v-container>
		</v-footer>
		<v-overlay
			class="overlay-disconnected"
			:model-value="showDisconnectedOverlay"
			content-class="content"
		>
			<RoomDisconnected />
		</v-overlay>
		<ServerMessageHandler />
		<WorkaroundPlaybackStatusUpdater />
		<WorkaroundUserStateNotifier />
	</div>
</template>

<script lang="ts">
import { mdiPlay, mdiFormatListBulleted, mdiPlus, mdiWrench } from "@mdi/js";
import {
	defineComponent,
	ref,
	type Ref,
	unref,
	computed,
	watch,
	onMounted,
	onUnmounted,
	nextTick,
	provide,
	useTemplateRef,
} from "vue";
import AddPreview from "@/components/AddPreview.vue";
import { calculateCurrentPosition } from "ott-common/timestamp";
import _ from "lodash";
import OmniPlayer from "@/components/players/OmniPlayer.vue";
import Chat from "@/components/Chat.vue";
import UserList from "@/components/UserList.vue";
import VideoQueue from "@/components/VideoQueue.vue";
import { useGoTo } from "vuetify";
import RoomSettingsForm from "@/components/RoomSettingsForm.vue";
import ShareInvite from "@/components/ShareInvite.vue";
import ClientSettingsDialog from "@/components/ClientSettingsDialog.vue";
import RoomDisconnected from "../components/RoomDisconnected.vue";
import { useConnection } from "@/plugins/connection";
import { useRoomApi } from "@/util/roomapi";
import ServerMessageHandler from "@/components/ServerMessageHandler.vue";
import WorkaroundPlaybackStatusUpdater from "@/components/WorkaroundPlaybackStatusUpdater.vue";
import WorkaroundUserStateNotifier from "@/components/WorkaroundUserStateNotifier.vue";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import type { ServerMessageSync } from "ott-common/models/messages";
import { useScreenOrientation, useMouseInElement } from "@vueuse/core";
import { KeyboardShortcuts, RoomKeyboardShortcutsKey } from "@/util/keyboard-shortcuts";
import VideoControls from "@/components/controls/VideoControls.vue";
import AudiencePlayButton from "@/components/AudiencePlayButton.vue";
import RestoreQueue from "@/components/RestoreQueue.vue";
import VoteSkip from "@/components/VoteSkip.vue";
import { waitForToken } from "@/util/token";
import { useSfx } from "@/plugins/sfx";
import { secondsToTimestamp } from "@/util/timestamp";
import { useCaptions, useMediaPlayer, useVolume } from "@/components/composables";
import { useGrants } from "@/components/composables/grants";
import { isOfficialSite } from "@/util/misc";

const VIDEO_CONTROLS_HIDE_TIMEOUT = 3000;

export default defineComponent({
	name: "room",
	components: {
		VideoControls,
		AudiencePlayButton,
		VideoQueue,
		OmniPlayer,
		Chat,
		AddPreview,
		UserList,
		RoomSettingsForm,
		ShareInvite,
		ClientSettingsDialog,
		RoomDisconnected,
		ServerMessageHandler,
		WorkaroundPlaybackStatusUpdater,
		WorkaroundUserStateNotifier,
		RestoreQueue,
		VoteSkip,
	},
	setup() {
		const store = useStore();
		const connection = useConnection();
		const roomapi = useRoomApi(connection);
		const { t } = useI18n();
		const router = useRouter();
		const route = useRoute();

		// Embed mode detection
		const isEmbedMode = computed(() => {
			const isEmbed = route.query.embed === 'true';
			if (isEmbed) {
				console.log('🎬 Embed mode activated');
			}
			return isEmbed;
		});

		// Projection booth mode detection
		const isProjectionMode = computed(() => {
			const isProjection = route.query.projection === 'true';
			if (isProjection) {
				console.log('🎬 Projection booth mode activated');
			}
			return isProjection;
		});

		// Controls-only mode detection (for separate controls iframe)
		const isControlsOnlyMode = computed(() => {
			const isControlsOnly = route.query.controlsonly === 'true';
			if (isControlsOnly) {
				console.log('🎮 Controls-only mode activated');
			}
			return isControlsOnly;
		});

		// Projectionist status (for projection booth mode)
		// Use internal ref that gets updated, wrapped in computed for reactivity
		const isProjectionistValue = ref(false);
		const isProjectionist = computed(() => isProjectionistValue.value);

		// Reactive state for screen dimensions and fullscreen (for mobile controls detection)
		const isMobilePortrait = ref(false);
		const isInFullscreen = ref(false);

		// Check if mobile=check parameter is present (means parent wants us to verify mobile status)
		const shouldCheckMobile = computed(() => {
			return route.query.mobile === 'check';
		});

		// More reliable mobile detection using user agent AND screen size
		function isTrulyMobile() {
			// Check user agent for mobile devices
			const userAgent = navigator.userAgent || navigator.vendor || window.opera;
			const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

			// Check screen size
			const isMobileScreen = window.matchMedia('(max-width: 760px)').matches;

			// Check for touch capability
			const isTouchDevice = (
				'ontouchstart' in window ||
				navigator.maxTouchPoints > 0 ||
				(navigator as any).msMaxTouchPoints > 0
			);

			// If mobile=check parameter is present, require mobile user agent AND screen size AND touch capability
			// This prevents desktop browsers with small windows from triggering mobile behavior
			if (shouldCheckMobile.value) {
				console.log('🔍 Mobile check:', {isMobileUA, isMobileScreen, isTouchDevice, userAgent: userAgent.substring(0, 50)});
				return isMobileUA && isMobileScreen && isTouchDevice;
			}

			// Fallback: just use screen size
			return isMobileScreen;
		}

		function updateMobilePortraitState() {
			const isMobile = isTrulyMobile();
			const isPortrait = window.matchMedia('(orientation: portrait)').matches;
			isMobilePortrait.value = isMobile && isPortrait;

			if (shouldCheckMobile.value) {
				console.log('📱 Mobile portrait state updated:', {isMobile, isPortrait, isMobilePortrait: isMobilePortrait.value});
			}
		}

		function updateFullscreenState() {
			isInFullscreen.value = document.fullscreenElement !== null;
		}

		// Compute whether controls should be shown
		// In projection mode, hide controls on mobile portrait for audience (show in landscape/fullscreen)
		const shouldShowControls = computed(() => {
			// Controls-only mode always shows controls
			if (isControlsOnlyMode.value) {
				return true;
			}

			// Projection mode audience: hide controls on mobile portrait (unless fullscreen)
			// Controls will show in landscape or when fullscreen
			if (isProjectionMode.value && !isProjectionist.value) {
				// Hide controls if mobile + portrait + not fullscreen
				if (isMobilePortrait.value && !isInFullscreen.value) {
					console.log('🎬 Hiding controls on mobile portrait (audience mode) - controls hidden until landscape or fullscreen');
					return false;
				}
			}

			console.log('🎬 shouldShowControls decision:', {
				isControlsOnlyMode: isControlsOnlyMode.value,
				isProjectionMode: isProjectionMode.value,
				isProjectionist: isProjectionist.value,
				isMobilePortrait: isMobilePortrait.value,
				isInFullscreen: isInFullscreen.value,
				result: true
			});

			// Default: show controls
			return true;
		});

		// Compute whether user has full control permissions
		const hasFullControlAccess = computed(() => {
			if (!isProjectionMode.value) {
				return true; // Normal mode - full access
			}
			return isProjectionistValue.value; // Projection mode - only projectionist has full access
		});

		// video control visibility
		const controlsVisible = ref(true);
		const videoControlsHideTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
		const playerContainer = useTemplateRef<HTMLDivElement>("playerContainer");
		const mouse = useMouseInElement(playerContainer);
		const isIframeBasedPlayer = ref(false);

		function setVideoControlsVisibility(visible: boolean) {
			controlsVisible.value = visible;
			if (videoControlsHideTimeout.value) {
				clearTimeout(videoControlsHideTimeout.value);
				videoControlsHideTimeout.value = null;
			}
		}
		/**
		 * Show the video controls, then hide them after `VIDEO_CONTROLS_HIDE_TIMEOUT` milliseconds.
		 */
		function activateVideoControls() {
			setVideoControlsVisibility(true);
			if (controlsMode.value !== "outside-video") {
				videoControlsHideTimeout.value = setTimeout(() => {
					setVideoControlsVisibility(false);
				}, VIDEO_CONTROLS_HIDE_TIMEOUT);
			}
		}

		watch([mouse.x, mouse.y], () => {
			if (!store.state.room.isPlaying) {
				setVideoControlsVisibility(true);
				return;
			}

			// For non-iframe players, only show controls when mouse is inside the player
			if (!isIframeBasedPlayer.value && mouse.isOutside.value) {
				return;
			}

			activateVideoControls();
		});

		const controlsMode = computed(() =>
			currentSource.value?.service === "youtube" ? "outside-video" : "in-video"
		);

		// actively calculate the current position of the video
		const truePosition = ref(0);
		const sliderPosition = ref(0);
		const iTimestampUpdater: Ref<ReturnType<typeof setInterval> | null> = ref(null);

		function timestampUpdate() {
			if (!store.state.room.currentSource) {
				truePosition.value = 0;
				sliderPosition.value = 0;
				return;
			}
			truePosition.value = store.state.room.isPlaying
				? calculateCurrentPosition(
						store.state.room.playbackStartTime,
						new Date(),
						store.state.room.playbackPosition,
						store.state.room.playbackSpeed
				  )
				: store.state.room.playbackPosition;
			sliderPosition.value = _.clamp(
				truePosition.value,
				0,
				store.state.room.currentSource?.length ?? 0
			);
		}

		onMounted(() => {
			iTimestampUpdater.value = setInterval(timestampUpdate, 250);

			// Initialize mobile portrait and fullscreen state
			updateMobilePortraitState();
			updateFullscreenState();

			// Watch for orientation and resize changes
			window.addEventListener('resize', updateMobilePortraitState);
			const orientationMQ = window.matchMedia('(orientation: portrait)');
			orientationMQ.addEventListener('change', updateMobilePortraitState);

			// Watch for fullscreen changes
			document.addEventListener('fullscreenchange', updateFullscreenState);

			// Listen for projectionist status from parent frame
			if (isProjectionMode.value) {
				const handleParentMessage = (event: MessageEvent) => {
					// Accept messages from any origin for now
					// TODO: Add origin validation in production
					if (event.data && event.data.type === 'ott-projectionist-status') {
						const newStatus = event.data.isProjectionist === true;
						console.log('🎬 Received projectionist message:', event.data, 'setting to:', newStatus);
						isProjectionistValue.value = newStatus;
						console.log('🎬 Projectionist ref updated to:', isProjectionistValue.value);
						console.log('🎬 Computed isProjectionist now returns:', isProjectionist.value);
					}
				};

				window.addEventListener('message', handleParentMessage);

				// Request initial status from parent
				if (window.parent && window.parent !== window) {
					window.parent.postMessage({
						type: 'ott-request-projectionist-status'
					}, '*');
				}
			}
		});

		onUnmounted(() => {
			if (iTimestampUpdater.value) {
				clearInterval(iTimestampUpdater.value);
			}
		});

		watch(truePosition, async newPosition => {
			if (!player.isPlayerPresent()) {
				return;
			}
			const currentTime = player.getPosition();

			const diff = Math.abs(newPosition - (await currentTime));
			if (isNaN(diff)) {
				console.error("player diff is NaN, this is a bug", newPosition, currentTime);
				return;
			}
			if (diff > 1 && !mediaPlaybackBlocked.value) {
				player.setPosition(newPosition);
			}
		});

		// connection status
		const isConnected = computed(() => connection.connected);
		const connectionStatus = computed(() => {
			return connection.connected.value
				? t("room.con-status.connected")
				: t("room.con-status.connecting");
		});
		const showDisconnectedOverlay = computed(() => !!connection.kickReason.value);

		function rewriteUrlToRoomName() {
			if (store.state.room.name.length === 0) {
				return;
			}
			if (route.params.roomId !== store.state.room.name) {
				console.debug(
					`room name does not match URL, rewriting to "${store.state.room.name}"`
				);
				router.replace({
					name: "room",
					params: { roomId: store.state.room.name },
				});
			}
		}

		async function waitForPlayer() {
			if (!player.isPlayerPresent()) {
				console.debug("waiting for player", player);
				await new Promise(resolve => {
					const stop = watch(player.player, async newPlayer => {
						if (newPlayer) {
							stop();
							resolve(true);
						}
					});
					// const interval = setInterval(() => {
					// 	if (player.isPlayerPresent()) {
					// 		clearInterval(interval);
					// 		resolve(true);
					// 	}
					// }, 100);
				});
			}
			if (!player.isPlayerPresent()) {
				return Promise.reject("Can't wait for player api ready: player not present");
			}
			if (player.apiReady.value) {
				return;
			}
			console.debug("detected player, waiting for api ready");
			await new Promise(resolve => {
				// const stop = watch(player.apiReady, async newReady => {
				// 	if (newReady) {
				// 		stop();
				// 		resolve(true);
				// 	}
				// });
				const interval = setInterval(() => {
					if (player.apiReady.value) {
						clearInterval(interval);
						resolve(true);
					}
				}, 100);
			});
		}

		async function onSyncMsg(msg: ServerMessageSync) {
			rewriteUrlToRoomName();
			if (msg.isPlaying !== undefined && !mediaPlaybackBlocked.value) {
				await applyIsPlaying(msg.isPlaying);
			}
		}

		function onRoomCreated() {
			if (connection.active.value) {
				connection.disconnect();
			}
			setTimeout(() => {
				if (!connection.active.value) {
					connection.connect(route.params.roomId as string);
				}
			}, 100);
		}

		let roomCreatedUnsub: (() => void) | null = null;
		onMounted(async () => {
			await waitForToken(store);

			connection.addMessageHandler("sync", onSyncMsg);
			if (!connection.active.value) {
				connection.connect(route.params.roomId as string);
			}

			roomCreatedUnsub = store.subscribe(mutation => {
				if (mutation.type === "misc/ROOM_CREATED") {
					onRoomCreated();
				}
			});
		});

		onUnmounted(() => {
			connection.removeMessageHandler("sync", onSyncMsg);
			connection.disconnect();

			if (roomCreatedUnsub) {
				roomCreatedUnsub();
			}
		});

		// player management
		const player = useMediaPlayer();
		const volume = useVolume();

		// Volume sync between iframes via postMessage
		// When in controls-only mode, send volume changes to parent window
		watch(() => volume.volume.value, (newVolume) => {
			if (isControlsOnlyMode.value && window.parent !== window) {
				window.parent.postMessage({
					type: 'ott-volume-change',
					volume: newVolume,
					isMuted: volume.isMuted.value
				}, '*');
				console.log('🔊 Sending volume change to parent:', newVolume);
			}
		});

		// Listen for volume changes from controls iframe and apply them
		const handleVolumeMessage = (event: MessageEvent) => {
			if (event.data.type === 'ott-volume-change') {
				console.log('🔊 Received volume change:', event.data.volume);
				volume.volume.value = event.data.volume;
				if (event.data.isMuted !== undefined) {
					volume.isMuted.value = event.data.isMuted;
				}
			}
		};

		onMounted(() => {
			window.addEventListener('message', handleVolumeMessage);
		});

		onUnmounted(() => {
			window.removeEventListener('message', handleVolumeMessage);
		});

		function togglePlayback() {
			if (store.state.room.isPlaying) {
				roomapi.pause();
			} else {
				roomapi.play();
			}
		}

		function seekDelta(delta: number) {
			roomapi.seek(
				_.clamp(truePosition.value + delta, 0, store.state.room.currentSource?.length ?? 0)
			);
		}

		// Indicates that starting playback is blocked by the browser. This usually means that the user needs
		// to interact with the page before playback can start. This is because browsers block autoplaying videos.
		const mediaPlaybackBlocked = ref(false);

		async function applyIsPlaying(playing: boolean): Promise<void> {
			await waitForPlayer();
			if (!player.isPlayerPresent()) {
				return Promise.reject("Can't apply IsPlaying: player not present");
			}
			try {
				if (playing) {
					await player.play();
				} else {
					await player.pause();
				}
				mediaPlaybackBlocked.value = false;
				return;
			} catch (e) {
				if (e instanceof DOMException && e.name === "NotAllowedError") {
					mediaPlaybackBlocked.value = true;
				} else {
					console.error("Can't apply IsPlaying: ", e.name, e);
				}
			}
		}

		function onClickUnblockPlayback(): void {
			player?.setPosition(truePosition.value);
			applyIsPlaying(store.state.room.isPlaying);
		}

		function onPlayerApiReady() {
			console.debug("internal player API is now ready");
		}

		async function onPlaybackChange(changeTo: boolean) {
			console.debug(`onPlaybackChange: ${changeTo}`);
			if (!changeTo) {
				setVideoControlsVisibility(true);
			} else {
				activateVideoControls();
			}
			if (changeTo === store.state.room.isPlaying) {
				return;
			}

			await applyIsPlaying(store.state.room.isPlaying);
		}
		function onPlayerReady() {
			if (currentSource.value?.service === "vimeo") {
				onPlayerReadyVimeo();
			}
			isIframeBasedPlayer.value = !!playerContainer.value?.querySelector("iframe");
			console.log("isIframeBasedPlayer:", isIframeBasedPlayer.value);
		}
		async function onPlayerReadyVimeo() {
			await applyIsPlaying(store.state.room.isPlaying);
		}

		const captions = useCaptions();
		function isCaptionsSupported() {
			return captions.isCaptionsSupported.value;
		}
		function getCaptionsTracks() {
			return captions.captionsTracks.value;
		}

		// misc UI stuff
		const isMobile = computed(
			() => window.matchMedia("only screen and (max-width: 760px)").matches
		);
		const orientation = useScreenOrientation();
		const queueTab = ref(0);
		const roomSettingsForm = ref<typeof RoomSettingsForm | null>(null);

		const goTo = useGoTo();
		onMounted(() => {
			if (!orientation.isSupported.value) {
				return;
			}

			watch(orientation.orientation, async newOrientation => {
				if (!newOrientation) {
					return;
				}
				if (isMobile.value) {
					if (newOrientation.startsWith("landscape")) {
						// this promise is rejected if the fullscreen request is denied
						await document.documentElement.requestFullscreen();
						goTo(0, {
							duration: 250,
							easing: "easeInOutCubic",
						});
					} else {
						document.exitFullscreen();
					}
				}
			});
		});

		watch(queueTab, async newTab => {
			if (roomSettingsForm.value && newTab === 2) {
				await roomSettingsForm.value.loadRoomSettings();
			}
		});

		const granted = useGrants();

		const addpreview = ref<typeof AddPreview | null>(null);
		async function setAddPreviewText(text: string) {
			queueTab.value = 1;
			await nextTick();
			if (!addpreview.value) {
				// HACK: the tab is not yet mounted, so we need to wait for it to be mounted
				// this will be more elegant when we have a new vue 3 style global event bus.
				await nextTick();
			}
			if (addpreview.value) {
				addpreview.value.setAddPreviewText(text);
			} else {
				console.error("addpreview is not mounted, can't set text");
			}
		}

		// keyboard shortcuts
		const shortcuts = new KeyboardShortcuts();
		shortcuts.bind([{ code: "Space" }, { code: "KeyK" }], () => {
			if (granted("playback.play-pause")) {
				togglePlayback();
			}
		});
		shortcuts.bind(
			[{ code: "ArrowLeft" }, { code: "ArrowRight" }, { code: "KeyJ" }, { code: "KeyL" }],
			(e: KeyboardEvent) => {
				if (granted("playback.seek")) {
					let seekIncrement = 5;
					if (e.ctrlKey || e.code === "KeyJ" || e.code === "KeyL") {
						seekIncrement = 10;
					}
					if (e.code === "ArrowLeft" || e.code === "KeyJ") {
						seekIncrement *= -1;
					}

					seekDelta(seekIncrement);
				}
			}
		);
		shortcuts.bind({ code: "Home" }, () => {
			if (granted("playback.seek")) {
				roomapi.seek(0);
			}
		});
		shortcuts.bind({ code: "End" }, () => {
			if (granted("playback.skip")) {
				roomapi.skip();
			}
		});
		shortcuts.bind([{ code: "ArrowUp" }, { code: "ArrowDown" }], (e: KeyboardEvent) => {
			volume.volume.value = _.clamp(
				volume.volume.value + 5 * (e.code === "ArrowDown" ? -1 : 1),
				0,
				100
			);
		});
		shortcuts.bind({ code: "F12", ctrlKey: true, shiftKey: true }, () => {
			debugMode.value = !debugMode.value;
		});
		function onKeyDown(e: KeyboardEvent) {
			shortcuts.handleKeyDown(e);
		}
		provide(RoomKeyboardShortcutsKey, shortcuts);

		onMounted(() => {
			window.addEventListener("keydown", onKeyDown);
		});

		onUnmounted(() => {
			window.removeEventListener("keydown", onKeyDown);
		});

		// small helper aliases
		const currentSource = computed(() => store.state.room.currentSource);
		const production = computed(() => store.state.production);

		// debug mode
		const debugMode = ref(!unref(production));
		provide("debugMode", debugMode);

		const sfx = useSfx();
		onMounted(async () => {
			await sfx.loadSfx();
		});

		const gitCommit = __COMMIT_HASH__;

		return {
			store,
			roomapi,
			granted,
			isOfficialSite,
			isEmbedMode,
			isProjectionMode,
			isProjectionist,
			isControlsOnlyMode,
			shouldShowControls,

			controlsVisible,
			videoControlsHideTimeout,
			controlsMode,

			truePosition,
			sliderPosition,

			isConnected,
			connectionStatus,
			showDisconnectedOverlay,

			player,
			volume,
			togglePlayback,
			onPlayerApiReady,
			onPlayerReady,
			onPlaybackChange,
			isCaptionsSupported,
			getCaptionsTracks,

			isMobile,
			queueTab,
			settings: roomSettingsForm,
			addpreview,
			setAddPreviewText,

			currentSource,
			production,
			debugMode,
			orientation: orientation.orientation,
			gitCommit,

			mediaPlaybackBlocked,
			onClickUnblockPlayback,
			secondsToTimestamp,

			// MDI Icons
			mdiPlay,
			mdiFormatListBulleted,
			mdiPlus,
			mdiWrench,
		};
	},
});
</script>

<style lang="scss">
@use "../variables.scss";
@use "../components/controls/media-controls.scss";

$video-player-max-height: 75vh;
$video-player-max-height-theater: 90vh;
$in-video-chat-width: 400px;
$in-video-chat-width-small: 250px;

// Controls-only mode container (for separate controls iframe)
.controls-only-container {
	width: 100%;
	min-height: 80px;
	display: flex;
	align-items: center;
	background: transparent;
	overflow: hidden; // Hide any overflow content
}

.video-container {
	display: grid;
	grid-template-columns: 1fr auto;
	grid-template-rows: minmax(400px, 70vh);
	width: 100%;
}

.video-subcontainer {
	position: relative;
	display: flex;
	flex-direction: column;
	height: 100%;
}

.player-container {
	width: 100%;
	height: 100%;
}

.layout-default {
	.video-subcontainer {
		width: 80%;
		justify-self: center;

		@media (max-width: variables.$md-max) {
			width: 100%;
		}
	}
}

.layout-theater {
	padding: 0;

	.video-container {
		grid-template-rows: minmax(400px, 85vh);
	}

	.room-title {
		font-size: 24px;
	}
}

.fullscreen {
	padding: 0;

	.video-container {
		display: block;
		margin: 0;
		height: 100vh;
		max-height: 100vh;
		aspect-ratio: inherit;
		width: 100vw;
	}

	.video-subcontainer {
		width: 100%;
		max-height: 100vh;
		padding: 0;
	}

	.player-container {
		height: 100vh;
	}
}

.in-video-chat {
	padding: 5px 10px;

	position: absolute;
	bottom: variables.$video-controls-height;
	right: 0;
	width: $in-video-chat-width;
	height: 70%;
	min-height: 70px;
	@media screen and (max-width: variables.$sm-max) {
		width: $in-video-chat-width-small;
	}
	pointer-events: none;
}

.out-video-chat {
	padding: 5px 10px;

	width: $in-video-chat-width;
	height: 300px;
	min-height: 100px;
	@media screen and (max-width: variables.$sm-max) {
		width: $in-video-chat-width-small;
	}
	pointer-events: none;
}

#mouse-event-swallower {
	position: absolute;
	top: 0;
	width: 100%;
	height: 100%;

	&.hide {
		display: none;
	}
}

.user-invite-container {
	padding: 0 10px;
	min-height: 500px;

	> * {
		margin-bottom: 10px;
	}
}

.queue-tab-content {
	// HACK: the save button in room settings is not sticky if overflow is not "visible"
	overflow: visible;
}

.tab-text {
	margin: 0 8px;

	@media screen and (max-width: variables.$sm-max) {
		display: none;
	}
}

.playback-blocked-prompt {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 200;
	display: flex;
	justify-content: center;
	align-items: center;
}

.flip-list-move {
	transition: transform 0.5s;
}
.no-move {
	transition: transform 0s;
}

.room {
	@media (max-width: variables.$md-max) {
		padding: 0;
	}
}

.room-header {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin: 0 10px;
	> * {
		align-self: flex-end;
	}
}

.overlay-disconnected {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;

	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		position: inherit;
	}
}

.banners {
	margin: 10px 0;
}

.grow {
	flex-grow: 1;
}

.under-video-grid {
	display: flex;
	width: 100%;

	@media screen and (max-width: variables.$sm-max) {
		flex-direction: column;
	}
}

.under-video-tabs {
	flex-grow: 1;
	width: 60%;

	@media screen and (max-width: variables.$sm-max) {
		width: 100%;
	}
}

/* Global scrollbar hiding for projection/embed modes */
html, body {
	scrollbar-width: none !important;  // Firefox
	-ms-overflow-style: none !important;  // IE/Edge

	&::-webkit-scrollbar {
		display: none !important;  // Chrome/Safari
		width: 0 !important;
		height: 0 !important;
	}
}

/* Embed container styles - clean, minimal video player only */
.embed-container {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: #000;
	margin: 0;
	padding: 0;
	overflow: hidden;

	// Force Vuetify scrollbar offset to 0 in embed mode to prevent gray bar
	--v-scrollbar-offset: 0px !important;

	// Explicitly hide any scrollbar elements
	scrollbar-width: none;  // Firefox
	-ms-overflow-style: none;  // IE/Edge

	&::-webkit-scrollbar {
		display: none;  // Chrome/Safari
		width: 0;
		height: 0;
	}

	// Mobile viewport handling
	@media (max-width: variables.$xs-max) {
		// Use dynamic viewport height for mobile browsers
		height: 100dvh;
		// Ensure proper touch scrolling is disabled
		touch-action: none;
		-webkit-overflow-scrolling: touch;

		// When embedded in another page, add balanced padding for external UI
		padding-top: 80px; // Space for external header + margins
		padding-bottom: 60px; // Space for external controls + safe area
	}
}

// Projection booth mode - remove mobile padding (parent iframe container handles spacing)
.embed-container:has(.video-container.projection-mode) {
	@media (max-width: variables.$xs-max) {
		padding: 0;
		margin: 0;
	}
}

.embed-container .video-container {
	width: 100%;
	height: 100%;
	display: grid;
	grid-template-columns: 1fr;
	grid-template-rows: 1fr;
	margin: 0;
	padding: 0;
	overflow: hidden;

	// Ensure no scrollbar gutter
	scrollbar-width: none;
	-ms-overflow-style: none;

	&::-webkit-scrollbar {
		display: none;
		width: 0;
	}

	@media (max-width: variables.$xs-max) {
		height: 100%; // Fill parent container with padding
		// Ensure content fills mobile viewport properly
		min-height: 280px; // Ensure minimum viable space for video + controls
	}
}

.embed-container .video-subcontainer {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	overflow: hidden;

	// Ensure no scrollbar appearance
	scrollbar-width: none;
	&::-webkit-scrollbar {
		display: none;
	}

	@media (max-width: variables.$xs-max) {
		height: 100%; // Fill parent container
		// Use flex layout that properly accommodates grid child
		min-height: 280px; // Match video-container minimum
		flex: 1;
		overflow: hidden;
	}
}

.embed-container .player-container {
	width: 100%;
	flex: 1;
	position: relative;
	margin: 0;
	padding: 0;
	// Ensure video scales properly
	overflow: hidden;
	
	@media (max-width: variables.$xs-max) {
		// Use CSS Grid for proper space allocation
		display: grid;
		grid-template-rows: 1fr auto;
		height: 100%; // Fill parent container
		
		// Ensure video area maintains proper aspect ratio and fits available space
		// Only apply grid positioning to video elements, not overlay elements like mouse-event-swallower
		.player,
		.omniplayer-container,
		.playback-blocked-prompt {
			grid-row: 1;
			min-height: 200px; // Reasonable minimum for video visibility
			overflow: hidden;
		}
		
		// Position video controls in separate grid row
		.video-controls {
			grid-row: 2;
			position: relative;
			bottom: auto;
			margin-top: 8px; // Spacing between video and controls
		}
		
		// Fix video element scaling to properly fit constrained area
		video, iframe {
			object-fit: contain;
			width: 100% !important;
			height: 100% !important;
			max-width: 100% !important;
			max-height: 100% !important;
		}
		
		// Ensure any embedded players scale to fit
		.omniplayer-container {
			width: 100% !important;
			height: 100% !important;
			max-width: 100% !important;
			max-height: 100% !important;
		}
	}
}

// Projection booth mode - minimal single-column layout
.video-container.projection-mode {
	display: grid;
	grid-template-columns: 1fr;  // Single column - no sidebar
	grid-template-rows: 1fr;
	overflow: hidden;  // Prevent scrollbars
	margin: 0;
	padding: 0;
}

.projection-mode .video-subcontainer {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	overflow: hidden;
}

.projection-mode .player-container {
	width: 100%;
	flex: 1;
	position: relative;
	overflow: hidden;
}

// Additional mobile embed mode optimizations
@media (max-width: variables.$xs-max) {
	// When in embed mode on mobile, ensure body doesn't scroll
	body:has(.embed-container) {
		overflow: hidden;
		position: fixed;
		width: 100%;
		height: 100%;
	}
	
	// Mobile-specific video control positioning in embed mode
	.embed-container .video-controls {
		&.in-video {
			// Ensure controls are always visible on mobile for better UX
			opacity: 0.8;
			backdrop-filter: blur(4px);
			
			&:not(.hide) {
				opacity: 1;
			}
		}
	}
}
</style>
