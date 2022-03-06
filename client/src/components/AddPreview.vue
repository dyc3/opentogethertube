<template>
	<div class="video-add">
		<v-row>
			<v-textarea
				clearable
				auto-grow
				rows="1"
				:placeholder="$t('add-preview.placeholder')"
				v-model="inputAddPreview"
				@keydown="onInputAddPreviewKeyDown"
				@focus="onFocusHighlightText"
				:loading="isLoadingAddPreview"
				data-cy="add-preview-input"
			/>
		</v-row>
		<v-row>
			<div v-if="!production">
				<v-btn v-for="(v, idx) in testVideos" :key="idx" @click="postTestVideo(idx)">{{
					v[0]
				}}</v-btn>
			</div>
			<v-btn
				v-if="videos.length > 1"
				@click="addAllToQueue()"
				:loading="isLoadingAddAll"
				:disabled="isLoadingAddAll"
				>{{ $t("add-preview.add-all") }}</v-btn
			>
		</v-row>
		<v-row class="mt-6" v-if="isLoadingAddPreview" justify="center">
			<v-progress-circular indeterminate />
		</v-row>
		<v-row class="mt-6" justify="center" v-if="!isLoadingAddPreview">
			<div v-if="hasAddPreviewFailed">
				{{ videosLoadFailureText }}
			</div>
			<v-container
				fill-height
				v-if="
					videos.length == 0 &&
					inputAddPreview.length > 0 &&
					!hasAddPreviewFailed &&
					!isAddPreviewInputUrl
				"
			>
				<v-row justify="center" align="center">
					<v-col cols="12">
						{{ $t("add-preview.search-for", { search: inputAddPreview }) }}<br />
						<v-btn @click="requestAddPreviewExplicit">{{
							$t("add-preview.search")
						}}</v-btn>
					</v-col>
				</v-row>
			</v-container>
			<v-container v-else-if="inputAddPreview.length === 0">
				<v-row justify="center" align="center">
					<div class="add-video-helper">
						<h1>{{ $t("add-preview.title") }}</h1>
						<h3>{{ $t("add-preview.single-videos") }}</h3>
						<ul>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.youtube-videos', {
											url: 'https://youtube.com/watch?v=LP8GRjv6AIo',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.vimeo-videos', {
											url: 'https://vimeo.com/94338566',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.dailymotion-videos', {
											url: 'https://dailymotion.com/video/x31i1so',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.any-mp4-videos', {
											url: 'https://vjs.zencdn.net/v/oceans.mp4',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
						</ul>
						<h3>{{ $t("add-preview.playlists") }}</h3>
						<ul>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.youtube-playlists', {
											url: 'https://youtube.com/playlist?list=PLv-kM7bcufALqOQvMsrVCQCEL1pIWScoQ',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.youtube-channels', {
											url: 'https://youtube.com/channel/UCI1XS_GkLGDOgf8YLaaXNRA',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
							<li>
								<ProcessedText
									:text="
										$t('add-preview.platforms.subreddits', {
											url: 'https://reddit.com/r/youtubehaiku/',
										})
									"
									@link-click="setAddPreviewText"
								/>
							</li>
						</ul>
						<span>{{ $t("add-preview.text") }}</span>
					</div>
				</v-row>
			</v-container>
		</v-row>
		<div v-if="highlightedAddPreviewItem">
			<VideoQueueItem
				:item="highlightedAddPreviewItem"
				is-preview
				style="margin-bottom: 20px"
			/>
			<h4>{{ $t("add-preview.playlist") }}</h4>
		</div>
		<VideoQueueItem
			v-for="(itemdata, index) in videos"
			:key="index"
			:item="itemdata"
			is-preview
		/>
	</div>
</template>

<script>
import { API } from "@/common-http.js";
import _ from "lodash";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import ProcessedText from "@/components/ProcessedText.vue";
import { ToastStyle } from "@/models/toast";
import Vue from "vue";

export default Vue.extend({
	name: "AddPreview",
	components: {
		VideoQueueItem,
		ProcessedText,
	},
	data() {
		return {
			videos: [],
			isLoadingAddPreview: false,
			hasAddPreviewFailed: false,
			inputAddPreview: "",
			isLoadingAddAll: false,
			videosLoadFailureText: "",

			testVideos: [
				["test youtube 0", "https://www.youtube.com/watch?v=IG2JF0P4GFA"],
				["test youtube 1", "https://www.youtube.com/watch?v=LP8GRjv6AIo"],
				["test vimeo 0", "https://vimeo.com/94338566"],
				["test vimeo 1", "https://vimeo.com/239423699"],
				["test dailymotion 0", "https://www.dailymotion.com/video/x6hkywd"],
				[
					"test direct 0",
					"https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
				],
				["test direct 1", "https://vjs.zencdn.net/v/oceans.mp4"],
				[
					"test hls 0",
					"https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
				],
			],
		};
	},
	computed: {
		highlightedAddPreviewItem() {
			return _.find(this.videos, { highlight: true });
		},
		isAddPreviewInputUrl() {
			try {
				return !!new URL(this.inputAddPreview).host;
			} catch (e) {
				return false;
			}
		},
		/**
		 * This is used so we can test for development/production only behavior in unit tests.
		 * Do not change.
		 */
		production() {
			return this.$store.state.production;
		},
	},
	methods: {
		async requestAddPreview() {
			await API.get(`/data/previewAdd?input=${encodeURIComponent(this.inputAddPreview)}`, {
				validateStatus: status => status < 500,
			})
				.then(res => {
					this.isLoadingAddPreview = false;
					if (res.status === 200) {
						this.hasAddPreviewFailed = false;
						this.videos = res.data;
						console.log(`Got add preview with ${this.videos.length}`);
					} else if (res.status === 400) {
						this.hasAddPreviewFailed = true;
						this.videosLoadFailureText = res.data.error.message;
						if (
							res.data.error.name === "FeatureDisabledException" &&
							!this.isAddPreviewInputUrl
						) {
							window.open(
								`https://www.youtube.com/results?search_query=${encodeURIComponent(
									this.inputAddPreview
								)}`,
								"_blank"
							);
						}
					} else {
						console.warn("Unknown status for add preview response:", res.status);
						this.$toast.add({
							style: ToastStyle.Error,
							content: this.$t("add-preview.messages.unknown-status", {
								status: res.status,
							}),
						});
					}
				})
				.catch(err => {
					this.isLoadingAddPreview = false;
					this.hasAddPreviewFailed = true;
					this.videosLoadFailureText = this.$t("add-preview.messages.unknown-error");
					console.error("Failed to get add preview", err);
					this.$toast.add({
						style: ToastStyle.Error,
						content: this.$t("add-preview.messages.failed-to-get-add-preview"),
						duration: 6000,
					});
				});
		},
		requestAddPreviewDebounced: _.debounce(function () {
			// HACK: can't use an arrow function here because it will make `this` undefined
			this.requestAddPreview();
		}, 500),
		/**
		 * Request an add preview regardless of the current input.
		 */
		async requestAddPreviewExplicit() {
			this.isLoadingAddPreview = true;
			this.hasAddPreviewFailed = false;
			this.videos = [];
			await this.requestAddPreview();
		},
		async addAllToQueue() {
			this.isLoadingAddAll = true;
			try {
				await API.post(`/room/${this.$route.params.roomId}/queue`, { videos: this.videos });
			} catch (err) {
				let message = `${err}`;
				if (err.response) {
					message = `${err.response.data.error.message}`;
				}
				this.$toast.add({
					style: ToastStyle.Error,
					content: this.$t("add-preview.messages.failed-to-all-videos", {
						message: message,
					}),
					duration: 4000,
				});
			}
			this.isLoadingAddAll = false;
		},
		onInputAddPreviewChange() {
			this.hasAddPreviewFailed = false;
			if (!this.inputAddPreview || _.trim(this.inputAddPreview).length === 0) {
				this.videos = [];
				return;
			}
			if (!this.isAddPreviewInputUrl) {
				this.videos = [];
				// Don't send API requests for non URL inputs without the user's explicit input to do so.
				// This is to help conserve youtube API quota.
				return;
			}
			this.isLoadingAddPreview = true;
			this.videos = [];
			this.requestAddPreviewDebounced();
		},
		onInputAddPreviewKeyDown(e) {
			if (e.keyCode === 13) {
				e.preventDefault();
			}

			if (_.trim(this.inputAddPreview).length === 0 || this.isAddPreviewInputUrl) {
				return;
			}

			if (e.keyCode === 13 && this.videos.length === 0) {
				this.requestAddPreviewExplicit();
			}
		},
		async postTestVideo(v) {
			try {
				await API.post(`/room/${this.$route.params.roomId}/queue`, {
					url: this.testVideos[v][1],
				});
				this.$toast.add({
					style: ToastStyle.Success,
					content: `Added test video`,
					duration: 2000,
				});
			} catch (e) {
				console.error(e);
				this.$toast.add({
					style: ToastStyle.Error,
					content: `Failed to add test video: ${e}`,
					duration: 4000,
				});
			}
		},
		onFocusHighlightText(e) {
			e.target.select();
		},
		setAddPreviewText(text) {
			this.inputAddPreview = text;
		},
	},
	watch: {
		/**
		 * HACK: The @change event only triggers when the text field is defocused.
		 * This ensures that onInputAddPreviewChange() runs everytime the text field's value changes.
		 */
		inputAddPreview() {
			// HACK: ensure that inputAddPreview always a string
			if (this.inputAddPreview === null) {
				this.inputAddPreview = "";
			}
			this.onInputAddPreviewChange();
		},
	},
});
</script>

<style lang="scss" scoped>
@import "../variables.scss";

.video-add {
	margin: 0 20px;
	min-height: 500px;
}

.add-video-helper {
	width: 400px;
	@media (max-width: $sm-max) {
		width: 80%;
	}

	h1 {
		width: 100%;
		text-align: center;
	}

	li {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 1;
	}
}
</style>
