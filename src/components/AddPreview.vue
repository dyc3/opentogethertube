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
				{{ addPreviewLoadFailureText }}
				</div>
				<v-container fill-height v-if="videos.length == 0 && inputAddPreview.length > 0 && !hasAddPreviewFailed && !isAddPreviewInputUrl">
				<v-row justify="center" align="center">
					<v-col cols="12">
						Search YouTube for "{{ inputAddPreview }}" by pressing enter, or by clicking search.<br>
						<v-btn @click="requestAddPreviewExplicit">Search</v-btn>
					</v-col>
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

export default {
	name: "AddPreview",
	components: {
		VideoQueueItem,
	},
	data() {
		return {
			videos: [],
			isLoadingAddPreview: false,
			hasAddPreviewFailed: false,
			addPreviewLoadFailureText: "",
			inputAddPreview: "",
			isLoadingAddAll: false,

			testVideos: [
				["test youtube 0", "https://www.youtube.com/watch?v=WC66l5tPIF4"],
				["test youtube 1", "https://www.youtube.com/watch?v=aI67KDJRnvQ"],
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
				}
			}).catch(err => {
				this.isLoadingAddPreview = false;
				this.hasAddPreviewFailed = true;
				this.videosLoadFailureText = "An unknown error occurred when getting add preview. Try again later.";
				console.error("Failed to get add preview", err);
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
			await API.post(`/room/${this.$route.params.roomId}/queue`, { videos: this.videos });
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
			await API.post(`/room/${this.$route.params.roomId}/queue`, {
				url: this.testVideos[v][1],
			});
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
};
</script>

<style lang="scss" scoped>
@import "../variables.scss";

</style>
