<template>
	<div>
		<!-- HACK: For some reason, safari really doesn't like typescript enums. As a result, we are forced to not use the enums, and use their literal values instead. -->
		<v-container
			fluid
			:class="{
				'room': true,
				'fullscreen': $store.state.fullscreen,
				'layout-default': $store.state.settings.roomLayout === 'default',
				'layout-theater': $store.state.settings.roomLayout === 'theater',
			}"
			v-if="!showJoinFailOverlay"
		>
			<div class="room-header" v-if="!$store.state.fullscreen">
				<h1 class="room-title">
					{{
						$store.state.room.title != ""
							? $store.state.room.title
							: $store.state.room.isTemporary
							? $t("room.title-temp")
							: $store.state.room.name
					}}
				</h1>
				<ClientSettingsDialog />
				<div class="flex-grow-1"><!-- Spacer --></div>
				<span id="connectStatus">{{ connectionStatus }}</span>
			</div>
			<v-col :style="{ padding: $store.state.fullscreen ? 0 : 'inherit' }">
				<v-row
					no-gutters
					:class="{
						'video-container': true,
					}"
				>
					<div class="flex-grow-1"><!-- Spacer --></div>
					<div
						class="video-subcontainer"
						:style="{ padding: $store.state.fullscreen ? 0 : 'inherit' }"
					>
						<v-responsive
							class="player-container"
							:key="currentSource.service"
							:aspect-ratio="16 / 9"
							:max-height="$store.state.fullscreen ? '100vh' : '90vh'"
						>
							<OmniPlayer
								ref="player"
								:source="currentSource"
								:class="{ 'player': true, 'no-video': !currentSource.service }"
								@apiready="onPlayerApiReady"
								@playing="onPlaybackChange(true)"
								@paused="onPlaybackChange(false)"
								@ready="onPlayerReady"
								@buffering="onVideoBuffer"
								@error="onVideoError"
								@buffer-spans="
									spans => $store.commit('PLAYBACK_BUFFER_SPANS', spans)
								"
							/>
							<div
								id="mouse-event-swallower"
								:class="{ hide: controlsVisible }"
							></div>
							<v-col :class="{ 'video-controls': true, 'hide': !controlsVisible }">
								<vue-slider
									id="videoSlider"
									:interval="0.1"
									:lazy="true"
									v-model="sliderPosition"
									:max="$store.state.room.currentSource.length"
									:tooltip-formatter="sliderTooltipFormatter"
									:disabled="
										currentSource.length == null ||
										!grants.granted('playback.seek')
									"
									:process="getSliderProcesses"
									@change="sliderChange"
									:drag-on-click="true"
									tooltip="hover"
								/>
								<v-row no-gutters align="center">
									<v-btn
										@click="seekDelta(-10)"
										:disabled="!grants.granted('playback.seek')"
									>
										<v-icon>fa:fas fa-angle-left</v-icon>
										<v-tooltip activator="parent" location="bottom">
											<span>{{ $t("room.rewind") }}</span>
										</v-tooltip>
									</v-btn>
									<v-btn
										@click="togglePlayback()"
										:disabled="!grants.granted('playback.play-pause')"
									>
										<v-icon
											:icon="
												$store.state.room.isPlaying
													? 'fa:fas fa-pause'
													: 'fa:fas fa-play'
											"
										/>
										<v-tooltip activator="parent" location="bottom">
											<span>{{ $t("room.play-pause") }}</span>
										</v-tooltip>
									</v-btn>
									<v-btn
										@click="seekDelta(10)"
										:disabled="!grants.granted('playback.seek')"
									>
										<v-icon>fa:fas fa-angle-right</v-icon>
										<v-tooltip activator="parent" location="bottom">
											<span>{{ $t("room.skip") }}</span>
										</v-tooltip>
									</v-btn>
									<v-btn
										@click="api.skip()"
										:disabled="!grants.granted('playback.skip')"
									>
										<v-icon>fa:fas fa-fast-forward</v-icon>
										<v-tooltip activator="parent" location="bottom">
											<span>{{ $t("room.next-video") }}</span>
										</v-tooltip>
									</v-btn>
									<vue-slider
										v-model="volume"
										style="width: 150px; margin-left: 10px; margin-right: 20px"
										:process="
											dotsPos => [
												[0, dotsPos[0], { backgroundColor: '#ffb300' }],
											]
										"
										:drag-on-click="true"
									/>
									<div>
										<ClickToEdit
											v-model="truePosition"
											@change="value => api.seek(value)"
											:value-formatter="secondsToTimestamp"
											:value-parser="timestampToSeconds"
										/>
										<span>/</span>
										<span class="video-length">
											{{ lengthDisplay }}
										</span>
									</div>
									<v-btn
										v-if="debugMode"
										@click="api.kickMe()"
										:disabled="!isConnected"
										>{{ $t("room.kick-me") }}</v-btn
									>
									<div class="flex-grow-1"><!-- Spacer --></div>
									<ClosedCaptionsSwitcher
										:key="currentSource.id"
										:supported="isCaptionsSupported()"
										:tracks="$store.state.captions.availableTracks"
										@enable-cc="value => $refs.player.setCaptionsEnabled(value)"
										@cc-track="value => $refs.player.setCaptionsTrack(value)"
									/>
									<v-btn v-if="!isMobile" @click="rotateRoomLayout">
										<v-icon
											v-if="$store.state.settings.roomLayout === 'theater'"
											style="transform: scaleX(180%)"
											>fa:far fa-square</v-icon
										>
										<v-icon v-else style="transform: scaleX(130%)"
											>fa:far fa-square</v-icon
										>
									</v-btn>
									<v-btn @click="toggleFullscreen()" style="margin-left: 10px">
										<v-icon>fa:fas fa-compress</v-icon>
										<v-tooltip activator="parent" location="bottom">
											<span>{{ $t("room.toggle-fullscreen") }}</span>
										</v-tooltip>
									</v-btn>
								</v-row>
							</v-col>
							<div class="in-video-chat">
								<Chat ref="chat" @link-click="setAddPreviewText" />
							</div>
						</v-responsive>
					</div>
					<div class="flex-grow-1"><!-- Spacer --></div>
				</v-row>
				<v-row no-gutters>
					<v-col cols="12" md="8" sm="12">
						<v-tabs fixed-tabs v-model="queueTab" @change="onTabChange">
							<v-tab>
								<v-icon>fa:fas fa-list</v-icon>
								<span class="tab-text">{{ $t("room.tabs.queue") }}</span>
								<span class="bubble">{{
									$store.state.room.queue.length <= 99
										? $n($store.state.room.queue.length)
										: "99+"
								}}</span>
							</v-tab>
							<v-tab>
								<v-icon>fa:fas fa-plus</v-icon>
								<span class="tab-text">{{ $t("room.tabs.add") }}</span>
							</v-tab>
							<v-tab>
								<v-icon>fa:fas fa-cog</v-icon>
								<span class="tab-text">{{ $t("room.tabs.settings") }}</span>
							</v-tab>
						</v-tabs>
						<v-window v-model="queueTab" class="queue-tab-content">
							<v-window-item>
								<VideoQueue @switchtab="switchToAddTab" />
							</v-window-item>
							<v-window-item>
								<AddPreview ref="addpreview" />
							</v-window-item>
							<v-window-item>
								<RoomSettingsForm ref="settings" />
							</v-window-item>
						</v-window>
					</v-col>
					<v-col col="4" md="4" sm="12" class="user-invite-container">
						<div v-if="debugMode" class="debug-container">
							<v-card>
								<v-card-title> Debug (prod: {{ this.production }}) </v-card-title>
								<v-list-item>
									Player status: {{ this.$store.state.playerStatus }}
								</v-list-item>
								<v-list-item>
									Buffered:
									{{
										Math.round(this.$store.state.playerBufferPercent * 10000) /
										100
									}}%
								</v-list-item>
								<v-list-item
									v-if="
										this.$store.state.playerBufferSpans &&
										this.$store.state.playerBufferSpans.length > 0
									"
								>
									Buffered spans:
									{{ this.$store.state.playerBufferSpans.length }}
									{{
										Array.from(
											{ length: this.$store.state.playerBufferSpans.length },
											(v, k) => k++
										)
											.map(
												i =>
													`${i}: [${$store.state.playerBufferSpans.start(
														i
													)} => ${$store.state.playerBufferSpans.end(i)}]`
											)
											.join(" ")
									}}
								</v-list-item>
								<v-list-item>
									<span>Is Mobile: {{ this.isMobile }}</span>
								</v-list-item>
								<v-list-item>
									<span>Device Orientation: {{ this.orientation }}</span>
								</v-list-item>
								<v-list-item>
									<span
										>Video controls: timeoutId:
										{{ this.videoControlsHideTimeout }} visible:
										{{ this.controlsVisible }}</span
									>
								</v-list-item>
							</v-card>
						</div>
						<UserList :users="$store.state.room.users" v-if="$store.state.room.users" />
						<ShareInvite />
					</v-col>
				</v-row>
			</v-col>
		</v-container>
		<v-footer>
			<v-container pa-0>
				<v-row no-gutters align="center" justify="center">
					<router-link to="/privacypolicy">{{ $t("footer.privacy-policy") }}</router-link>
				</v-row>
			</v-container>
		</v-footer>
		<v-overlay
			class="overlay-disconnected"
			:model-value="showJoinFailOverlay"
			content-class="content"
		>
			<RoomDisconnected />
		</v-overlay>
		<ServerMessageHandler />
	</div>
</template>

<script>
import { API } from "@/common-http.js";
import AddPreview from "@/components/AddPreview.vue";
import { secondsToTimestamp, calculateCurrentPosition, timestampToSeconds } from "@/util/timestamp";
import _ from "lodash";
import VueSlider from "vue-slider-component";
import "vue-slider-component/theme/default.css";
import OmniPlayer from "@/components/players/OmniPlayer.vue";
import Chat from "@/components/Chat.vue";
import UserList from "@/components/UserList.vue";
import api from "@/util/api";
import { PlayerStatus, QueueMode } from "common/models/types";
import VideoQueue from "@/components/VideoQueue.vue";
// import { goTo } from "vuetify/lib/services/goto/index.mjs";
import RoomSettingsForm from "@/components/RoomSettingsForm.vue";
import ShareInvite from "@/components/ShareInvite.vue";
import ClickToEdit from "@/components/ClickToEdit.vue";
import { RoomLayoutMode } from "@/stores/settings";
import { GrantChecker } from "@/util/grants";
import ClosedCaptionsSwitcher from "@/components/controls/ClosedCaptionsSwitcher.vue";
import ClientSettingsDialog from "@/components/ClientSettingsDialog.vue";
import RoomDisconnected from "../components/RoomDisconnected.vue";
import { useConnection } from "@/plugins/connection";
import ServerMessageHandler from "@/components/ServerMessageHandler.vue";

const VIDEO_CONTROLS_HIDE_TIMEOUT = 3000;

export default {
	name: "room",
	components: {
		VideoQueue,
		VueSlider,
		OmniPlayer,
		Chat,
		AddPreview,
		UserList,
		RoomSettingsForm,
		ShareInvite,
		ClickToEdit,
		ClosedCaptionsSwitcher,
		ClientSettingsDialog,
		RoomDisconnected,
		ServerMessageHandler,
	},
	data() {
		return {
			debugMode: false,
			controlsVisible: true,

			truePosition: 0,
			sliderPosition: 0,
			sliderTooltipFormatter: secondsToTimestamp,
			seekPreview: null,
			volume: 100,

			queueTab: 0,

			snackbarActive: false,
			snackbarText: "",

			i_timestampUpdater: null,

			orientation: screen.orientation ? screen.orientation.type : undefined,
			videoControlsHideTimeout: null,

			api,
			QueueMode,
			RoomLayoutMode,
			timestampToSeconds,
			secondsToTimestamp,
			grants: new GrantChecker(),
		};
	},
	computed: {
		isConnected() {
			const connection = useConnection();
			return connection.connected.value;
		},
		connectionStatus() {
			const connection = useConnection();
			return connection.connected.value
				? this.$t("room.con-status.connected")
				: this.$t("room.con-status.connecting");
		},
		currentSource() {
			return this.$store.state.room.currentSource;
		},
		playbackPosition() {
			return this.$store.state.room.playbackPosition;
		},
		/**
		 * This is used so we can test for development/production only behavior in unit tests.
		 * Do not change.
		 */
		production() {
			return this.$store.state.production;
		},
		timestampDisplay() {
			return secondsToTimestamp(this.truePosition);
		},
		lengthDisplay() {
			return secondsToTimestamp(this.$store.state.room.currentSource.length || 0);
		},
		showJoinFailOverlay() {
			const connection = useConnection();
			return connection.kickReason.value !== null;
		},
		isMobile() {
			return window.matchMedia("only screen and (max-width: 760px)").matches;
		},
	},
	async created() {
		this.$store.subscribeAction(action => {
			if (action.type === "sync") {
				this.rewriteUrlToRoomName();
				if (Object.prototype.hasOwnProperty.call(action.payload, "isPlaying")) {
					this.applyIsPlaying(action.payload.isPlaying);
				}
			} else if (action.type === "chat") {
				/*
				 * HACK: passes along the chat message to the chat component.
				 * FIXME: Ideally, the chat component would subscribe to the vuex store itself, but we need to upgrade vuex to 4.0.0 to do that.
				 */
				this.$refs.chat.onChatReceived(action.payload);
			}
		});
		this.$store.subscribe(mutation => {
			if (mutation.type === "misc/ROOM_CREATED") {
				this.onRoomCreated();
			}
		});

		window.addEventListener("keydown", this.onKeyDown);
		if (screen.orientation) {
			screen.orientation.addEventListener("change", this.onScreenOrientationChange);
		}

		this.i_timestampUpdater = setInterval(this.timestampUpdate, 250);

		// HACK: for some reason, if we initialize debugMode as `!this.production` in data, debugMode is always true on page load in production.
		if (!this.production) {
			this.debugMode = true;
		}
	},
	destroyed() {
		clearInterval(this.i_timestampUpdater);
		const connection = useConnection();
		connection.disconnect();
		if (screen.orientation) {
			screen.orientation.removeEventListener("change", this.onScreenOrientationChange);
		}
		window.removeEventListener("keydown", this.onKeyDown);
	},
	methods: {
		/* ROOM API */

		// TODO: maybe move to util/api?
		/** Send a message to play or pause the video, depending on the current state. */
		togglePlayback() {
			if (this.$store.state.room.isPlaying) {
				api.pause();
			} else {
				api.play();
			}
		},

		/* OTHER */

		/** Clock that calculates what the true playback position should be. */
		timestampUpdate() {
			this.truePosition = this.$store.state.room.isPlaying
				? calculateCurrentPosition(
						this.$store.state.room.playbackStartTime,
						new Date(),
						this.$store.state.room.playbackPosition
				  )
				: this.$store.state.room.playbackPosition;
			this.sliderPosition = _.clamp(
				this.truePosition,
				0,
				this.$store.state.room.currentSource.length
			);
		},
		sliderChange(value) {
			if (!this.sliderDragging) {
				api.seek(value);
			}
		},

		applyIsPlaying(playing) {
			if (playing) {
				this.$refs.player.play();
			} else {
				this.$refs.player.pause();
			}
		},

		updateVolume() {
			if (!this.$refs.player) {
				return;
			}
			this.$refs.player.setVolume(this.volume);
		},
		onPlayerApiReady() {
			console.log("internal player API is now ready");
		},
		onPlaybackChange(changeTo) {
			console.log(`onPlaybackChange: ${changeTo}`);
			if (
				this.currentSource.service === "youtube" ||
				this.currentSource.service === "dailymotion"
			) {
				this.$store.commit("PLAYBACK_STATUS", PlayerStatus.ready);
			}
			if (!changeTo) {
				this.setVideoControlsVisibility(true);
			} else {
				this.activateVideoControls();
			}
			this.updateVolume();
			if (changeTo === this.$store.state.room.isPlaying) {
				return;
			}

			if (this.$store.state.room.isPlaying) {
				this.$refs.player.play();
			} else {
				this.$refs.player.pause();
			}
		},
		onPlayerReady() {
			this.$store.commit("PLAYBACK_STATUS", PlayerStatus.ready);

			if (this.currentSource.service === "vimeo") {
				this.onPlayerReady_Vimeo();
			}
		},
		onPlayerReady_Vimeo() {
			if (this.$store.state.room.isPlaying) {
				this.$refs.player.play();
			} else {
				this.$refs.player.pause();
			}
		},
		onKeyDown(e) {
			if (e.target.nodeName === "INPUT" || e.target.nodeName === "TEXTAREA") {
				return;
			}

			if (
				(e.code === "Space" || e.code === "k") &&
				this.grants.granted("playback.play-pause")
			) {
				this.togglePlayback();
				e.preventDefault();
			} else if (e.code === "Home" && this.grants.granted("playback.seek")) {
				api.seek(0);
				e.preventDefault();
			} else if (e.code === "End" && this.grants.granted("playback.skip")) {
				api.skip();
				e.preventDefault();
			} else if (e.code === "KeyF") {
				this.toggleFullscreen();
			} else if (
				(e.code === "ArrowLeft" ||
					e.code === "ArrowRight" ||
					e.code === "KeyJ" ||
					e.code === "KeyL") &&
				this.grants.granted("playback.seek")
			) {
				let seekIncrement = 5;
				if (e.ctrlKey || e.code === "KeyJ" || e.code === "KeyL") {
					seekIncrement = 10;
				}
				if (e.code === "ArrowLeft" || e.code === "KeyJ") {
					seekIncrement *= -1;
				}

				this.seekDelta(seekIncrement);
				e.preventDefault();
			} else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
				this.volume = _.clamp(this.volume + 5 * (e.code === "ArrowDown" ? -1 : 1), 0, 100);
				e.preventDefault();
			} else if (e.code === "KeyT") {
				e.preventDefault();
				this.$refs.chat.setActivated(true);
			} else if (e.code === "F12" && e.ctrlKey && e.shiftKey) {
				this.debugMode = !this.debugMode;
				e.preventDefault();
			}
		},
		toggleFullscreen() {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				document.documentElement.requestFullscreen();
				if (this.isMobile) {
					// force the device into landscape mode to get the user to rotate the device
					// but still allow exiting fullscreen by rotating the device back to portrait
					if (screen.orientation) {
						screen.orientation
							.lock("landscape")
							.then(() => screen.orientation.unlock());
					}
				}
			}
		},
		async onTabChange() {
			if ("settings" in this.$refs && this.queueTab === 2) {
				await this.$refs["settings"].loadRoomSettings();
			}
		},
		onVideoBuffer(percent) {
			this.$store.commit("PLAYBACK_STATUS", PlayerStatus.buffering);
			this.$store.commit("PLAYBACK_BUFFER", percent);
		},
		onVideoError() {
			this.$store.commit("PLAYBACK_STATUS", PlayerStatus.error);
		},
		setVideoControlsVisibility(visible) {
			this.controlsVisible = visible;
			if (this.videoControlsHideTimeout) {
				clearTimeout(this.videoControlsHideTimeout);
				this.videoControlsHideTimeout = null;
			}
		},
		/**
		 * Show the video controls, then hide them after `VIDEO_CONTROLS_HIDE_TIMEOUT` milliseconds.
		 */
		activateVideoControls() {
			this.setVideoControlsVisibility(true);
			this.videoControlsHideTimeout = setTimeout(() => {
				this.setVideoControlsVisibility(false);
			}, VIDEO_CONTROLS_HIDE_TIMEOUT);
		},
		rewriteUrlToRoomName() {
			if (this.$store.state.room.name.length === 0) {
				return;
			}
			if (this.$route.params.roomId !== this.$store.state.room.name) {
				console.log(
					`room name does not match URL, rewriting to "${this.$store.state.room.name}"`
				);
				this.$router.replace({
					name: "room",
					params: { roomId: this.$store.state.room.name },
				});
			}
		},
		seekDelta(delta) {
			api.seek(
				_.clamp(this.truePosition + delta, 0, this.$store.state.room.currentSource.length)
			);
		},
		onRoomCreated() {
			const connection = useConnection();
			if (connection.active.value) {
				connection.disconnect();
			}
			setTimeout(() => {
				if (!connection.active.value) {
					connection.connect(this.$route.params.roomId);
				}
			}, 100);
		},
		switchToAddTab() {
			this.queueTab = 1;
		},
		async setAddPreviewText(text) {
			this.queueTab = 1;
			await this.$nextTick();
			if (!this.$refs.addpreview) {
				// HACK: the tab is not yet mounted, so we need to wait for it to be mounted
				// this will be more elegant when we have a new vue 3 style global event bus.
				await this.$nextTick();
			}
			this.$refs.addpreview.setAddPreviewText(text);
		},
		onScreenOrientationChange() {
			this.orientation = screen.orientation.type;

			if (this.isMobile) {
				if (this.orientation.startsWith("landscape")) {
					document.documentElement.requestFullscreen();
					// goTo(0, {
					// 	duration: 250,
					// 	easing: "easeInOutCubic",
					// });
				} else {
					document.exitFullscreen();
				}
			}
		},
		/**
		 * Computes the `process` property of the playback position slider.
		 * Used to show colored intervals in the slider.
		 * Intervals will be layared in the order of they are listed. The last interval will appear on the top.
		 * Values are from 0 to 100, regardless of min and max values of the slider.
		 */
		getSliderProcesses(dotsPos) {
			let processes = [];

			const bufferedColor = "#e9be57";
			// show buffered spans
			if (this.$store.state.playerBufferSpans) {
				for (let i = 0; i < this.$store.state.playerBufferSpans.length; i++) {
					let start =
						this.$store.state.playerBufferSpans.start(i) /
						this.$store.state.room.currentSource.length;
					let end =
						this.$store.state.playerBufferSpans.end(i) /
						this.$store.state.room.currentSource.length;
					processes.push([start, end, { backgroundColor: bufferedColor }]);
				}
			} else if (this.$store.state.playerBufferPercent) {
				processes.push([
					0,
					this.$store.state.playerBufferPercent * 100,
					{ backgroundColor: bufferedColor },
				]);
			}

			// show seek preview, if present
			processes.push([0, (this.seekPreview ?? 0) * 100, { backgroundColor: "#00b3ff" }]);

			// show video progress
			processes.push([0, dotsPos[0], { backgroundColor: "#ffb300" }]);

			// show sponsorblock segments
			const colorMap = new Map([
				["sponsor", "#00d400"],
				["selfpromo", "#ffff00"],
				["interaction", "#cc00ff"],
				["intro", "#00ffff"],
				["outro", "#0202ed"],
			]);
			if ("videoSegments" in this.$store.state.room) {
				for (const segment of this.$store.state.room.videoSegments) {
					let start = (segment.startTime / segment.videoDuration) * 100;
					let end = (segment.endTime / segment.videoDuration) * 100;
					processes.push([
						start,
						end,
						{ backgroundColor: colorMap.get(segment.category) ?? "#ff0000" },
					]);
				}
			}

			return processes;
		},
		updateSeekPreview(e) {
			let slider = document.getElementById("videoSlider");
			let sliderRect = slider.getBoundingClientRect();
			let sliderPos = e.clientX - sliderRect.left;
			this.seekPreview = sliderPos / sliderRect.width;
		},
		resetSeekPreview() {
			this.seekPreview = null;
		},

		rotateRoomLayout() {
			let layouts = [RoomLayoutMode.default, RoomLayoutMode.theater];
			let newLayout =
				layouts[
					(layouts.indexOf(this.$store.state.settings.roomLayout) + 1) % layouts.length
				];
			this.$store.commit("settings/UPDATE", { roomLayout: newLayout });
		},

		isCaptionsSupported() {
			return this.$refs.player?.isCaptionsSupported() ?? false;
		},
		getCaptionsTracks() {
			if (!this.$refs.player) {
				return [];
			}
			return this.$refs.player.getCaptionsTracks() ?? [];
		},
	},
	async mounted() {
		document.onmousemove = () => {
			if (this.$store.state.room.isPlaying || !this.controlsVisible) {
				this.activateVideoControls();
			}
		};

		let slider = document.getElementById("videoSlider");
		slider.addEventListener("mousemove", this.updateSeekPreview);
		slider.addEventListener("mouseleave", this.resetSeekPreview);

		this.volume = this.$store.state.settings.volume;

		// await this.$store.dispatch("user/waitForToken");
		const connection = useConnection();
		if (!connection.active.value) {
			connection.connect(this.$route.params.roomId);
		}
	},
	updated() {
		let slider = document.getElementById("videoSlider");
		slider.removeEventListener("mousemove", this.updateSeekPreview);
		slider.removeEventListener("mouseleave", this.resetSeekPreview);
		slider.addEventListener("mousemove", this.updateSeekPreview);
		slider.addEventListener("mouseleave", this.resetSeekPreview);
	},
	watch: {
		volume() {
			this.updateVolume();
			this.$store.commit("settings/UPDATE", { volume: this.volume });
		},
		async truePosition(newPosition) {
			let currentTime = await this.$refs.player.getPosition();

			if (Math.abs(newPosition - currentTime) > 1) {
				this.$refs.player.setPosition(newPosition);
			}
		},
	},
};
</script>

<style lang="scss">
@import "../variables.scss";

$video-player-max-height: 75vh;
$video-player-max-height-theater: 90vh;
$video-controls-height: 80px;
$in-video-chat-width: 400px;
$in-video-chat-width-small: 250px;

.video-container {
	display: flex;
	align-items: center;
	margin-bottom: 10px;

	.player {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.no-video {
		height: 100%;
		color: #696969;
		border: 1px solid #666;
		border-radius: 3px;
	}

	.video-subcontainer {
		display: flex;
		flex-grow: 1;
	}

	@media (max-width: $md-max) {
		.video-subcontainer {
			width: 100%;
		}

		margin: 0;
	}
}

.layout-default {
	.video-container {
		max-height: $video-player-max-height;
	}

	.video-subcontainer {
		width: 80vw;
		max-height: $video-player-max-height;
	}
}

.layout-theater {
	padding: 0;

	.video-container {
		max-height: $video-player-max-height-theater;
	}

	.video-subcontainer {
		width: 100%;
		max-height: $video-player-max-height-theater;
	}

	.room-title {
		font-size: 24px;
	}
}

.video-controls {
	position: absolute;
	bottom: 0;
	height: $video-controls-height;

	background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
	transition: all 0.2s;

	&.hide {
		opacity: 0;
		transition: all 0.5s;
		bottom: -100%;
	}
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
	background: transparent !important;
}

.tab-text {
	margin: 0 8px;

	@media screen and (max-width: $sm-max) {
		display: none;
	}
}

.bubble {
	height: 25px;
	width: 25px;
	background-color: #3f3838;
	border-radius: 50%;
	display: inline-block;

	font-weight: bold;
	color: #fff;
	text-align: center;
	line-height: 1.8;

	@media screen and (max-width: $sm-max) {
		margin-left: 8px;
	}
}

.in-video-chat {
	padding: 5px 10px;

	position: absolute;
	bottom: $video-controls-height;
	right: 0;
	width: $in-video-chat-width;
	height: 70%;
	min-height: 70px;
	@media screen and (max-width: $sm-max) {
		width: $in-video-chat-width-small;
	}
	pointer-events: none;

	.chat {
		height: 100%;
	}
}

.flip-list-move {
	transition: transform 0.5s;
}
.no-move {
	transition: transform 0s;
}

.fullscreen {
	padding: 0;

	.video-container {
		margin: 0;
		height: 100vh;
		max-height: 100vh;

		.video-subcontainer {
			width: 100%;
			max-height: 100vh;
		}
	}

	.player-container {
		height: 100vh;

		.player {
			border: none;
			border-right: 1px solid #666;
		}
	}
}

.room {
	@media (max-width: $md-max) {
		padding: 0;
	}
}

.room-header {
	display: flex;
	flex-direction: row;
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
</style>
