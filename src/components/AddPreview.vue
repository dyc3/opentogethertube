<template>
	<div class="video-add">
		<div>
			<v-text-field clearable placeholder="Type to search YouTube or enter a Video URL to add to the queue" v-model="inputAddPreview" @keydown="onInputAddPreviewKeyDown" @focus="onFocusHighlightText" :loading="isLoadingAddPreview" />
			<div v-if="!production">
				<v-btn v-for="(v, idx) in testVideos" :key="idx" @click="postTestVideo(idx)">{{ v[0] }}</v-btn>
			</div>
			<v-btn v-if="videos.length > 1" @click="addAllToQueue()" :loading="isLoadingAddAll" :disabled="isLoadingAddAll">Add All</v-btn>
		</div>
		<v-row v-if="isLoadingAddPreview" justify="center">
			<v-progress-circular indeterminate/>
		</v-row>
		<div v-if="!isLoadingAddPreview">
			<v-row justify="center">
				<div v-if="hasAddPreviewFailed">
				{{ videosLoadFailureText }}
				</div>
				<v-container fill-height v-if="videos.length == 0 && inputAddPreview.length > 0 && !hasAddPreviewFailed && !isAddPreviewInputUrl">
				<v-row justify="center" align="center">
					<v-col cols="12">
						Search YouTube for "{{ inputAddPreview }}" by pressing enter, or by clicking search.<br>
						<v-btn @click="requestAddPreviewExplicit">Search</v-btn>
					</v-col>
				</v-row>
				</v-container>
				<v-container v-else-if="inputAddPreview.length === 0">
					<v-row justify="center" align="center">
						<div class="add-video-helper">
							<h1>What can I add?</h1>
							<h3>Single Videos</h3>
							<ul>
								<li><ProcessedText text="Youtube videos: https://youtube.com/watch?v=LP8GRjv6AIo" /></li>
								<li><ProcessedText text="Vimeo videos: https://vimeo.com/94338566" /></li>
								<li><ProcessedText text="Dailymotion videos: https://dailymotion.com/video/x31i1so" /></li>
								<li><ProcessedText text="Any public .mp4 video: https://vjs.zencdn.net/v/oceans.mp4" /></li>
							</ul>
							<h3>Playlists</h3>
							<ul>
								<li><ProcessedText text="Youtube playlists: https://youtube.com/playlist?list=PLv-kM7bcufALqOQvMsrVCQCEL1pIWScoQ" /></li>
								<li><ProcessedText text="Youtube channels: https://youtube.com/channel/UCI1XS_GkLGDOgf8YLaaXNRA" /></li>
								<li><ProcessedText text="Subreddits: https://reddit.com/r/youtubehaiku/" /></li>
								<li><ProcessedText text="Neverthink.tv channels: https://neverthink.tv/c/meme-radar" /></li>
							</ul>
							<span>Or just type text to search Youtube.</span>
						</div>
					</v-row>
				</v-container>
			</v-row>
			<div v-if="highlightedAddPreviewItem">
				<VideoQueueItem :item="highlightedAddPreviewItem" is-preview style="margin-bottom: 20px"/>
				<h4>Playlist</h4>
			</div>
			<VideoQueueItem v-for="(itemdata, index) in videos" :key="index" :item="itemdata" is-preview/>
		</div>
	</div>
</template>

<script>
import { API } from "@/common-http.js";
import _ from "lodash";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import ProcessedText from "@/components/ProcessedText.vue";
import { ToastStyle } from '@/models/toast';
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
				["test direct 0", "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"],
				["test direct 1", "https://vjs.zencdn.net/v/oceans.mp4"],
			],
		};
	},
	computed: {
		highlightedAddPreviewItem() {
			return _.find(this.videos, { highlight: true });
		},
		isAddPreviewInputUrl() {
			try {
				return !!(new URL(this.inputAddPreview).host);
			}
			catch (e) {
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
	created() {
		this.$events.on("onChatLinkClick", link => {
			this.inputAddPreview = link;
		});
	},
	methods: {
		async requestAddPreview() {
			await API.get(`/data/previewAdd?input=${encodeURIComponent(this.inputAddPreview)}`, { validateStatus: status => status < 500 }).then(res => {
				this.isLoadingAddPreview = false;
				if (res.status === 200) {
					this.hasAddPreviewFailed = false;
					this.videos = res.data;
					console.log(`Got add preview with ${this.videos.length}`);
				}
				else if (res.status === 400) {
					this.hasAddPreviewFailed = true;
					this.videosLoadFailureText = res.data.error.message;
					if (res.data.error.name === "FeatureDisabledException" && !this.isAddPreviewInputUrl) {
						window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(this.inputAddPreview)}`, "_blank");
					}
				}
				else {
					console.warn("Unknown status for add preview response:", res.status);
					this.$toast.add({
						style: ToastStyle.Error,
						content: `Unknown status for add preview response: ${res.status}.`,
					});
				}
			}).catch(err => {
				this.isLoadingAddPreview = false;
				this.hasAddPreviewFailed = true;
				this.videosLoadFailureText = "An unknown error occurred when getting add preview. Try again later.";
				console.error("Failed to get add preview", err);
				this.$toast.add({
					style: ToastStyle.Error,
					content: "Failed to get add preview. This is probably a bug, check console for details.",
					duration: 6000,
				});
			});
		},
		requestAddPreviewDebounced: _.debounce(function() {
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
			}
			catch (err) {
				let message = `${err}`;
				if (err.response) {
					message = `${err.response.data.error.message}`;
				}
				this.$toast.add({
					style: ToastStyle.Error,
					content: `Failed to all videos: ${message}`,
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
			this.requestAddPreviewDebounced();
		},
		onInputAddPreviewKeyDown(e) {
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
			}
			catch (e) {
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
