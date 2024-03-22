<template>
	<div class="video-add">
		<v-row>
			<v-sheet rounded width="100%" elevation="10" style="margin: 8px 0; padding: 5px 20px">
				<v-textarea
					clearable
					auto-grow
					variant="underlined"
					rows="1"
					:label="$t('add-preview.label')"
					:placeholder="$t('add-preview.placeholder')"
					v-model="inputAddPreview"
					@keydown="onInputAddPreviewKeyDown"
					@focus="onFocusHighlightText"
					:loading="isLoadingAddPreview"
					prepend-inner-icon="mdi-magnify"
					base-color="primary"
					color="primary"
					persistent-clear
					data-cy="add-preview-input"
				/>
			</v-sheet>
		</v-row>
		<v-row>
			<div v-if="!production">
				<v-btn
					v-for="(v, idx) in testVideos"
					:key="idx"
					@click="inputAddPreview = v[1]"
					data-cy="test-video"
				>
					{{ v[0] }}
				</v-btn>
			</div>
			<v-btn
				v-if="videos.length > 1"
				@click="addAllToQueue()"
				:loading="isLoadingAddAll"
				:disabled="isLoadingAddAll"
				prepend-icon="mdi-plus"
			>
				{{ $t("add-preview.add-all") }}
			</v-btn>
		</v-row>
		<v-row class="video-list" v-if="isLoadingAddPreview">
			<v-progress-circular indeterminate />
		</v-row>
		<v-row class="video-list" v-if="!isLoadingAddPreview">
			<div v-if="hasAddPreviewFailed">
				{{ videosLoadFailureText }}
			</div>
			<v-container
				v-if="
					videos.length == 0 &&
					inputAddPreview.length > 0 &&
					!hasAddPreviewFailed &&
					!isAddPreviewInputUrl
				"
			>
				<v-row>
					<v-col>
						{{ $t("add-preview.search-for", { search: inputAddPreview }) }}<br />
						<v-btn
							@click="requestAddPreviewExplicit"
							data-cy="add-preview-manual-search"
						>
							{{ $t("common.search") }}
						</v-btn>
					</v-col>
				</v-row>
			</v-container>
			<v-container v-else-if="inputAddPreview.length === 0">
				<v-row justify="center">
					<AddPreviewHelper @link-click="setAddPreviewText" />
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

<script lang="ts">
import { defineComponent, ref, computed, watch, Ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { API } from "@/common-http";
import _ from "lodash";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import { ToastStyle } from "@/models/toast";
import toast from "@/util/toast";
import { Video } from "ott-common/models/video";
import { OttResponseBody, OttApiResponseAddPreview } from "ott-common/models/rest-api";
import axios from "axios";
import AddPreviewHelper from "./AddPreviewHelper.vue";

export const AddPreview = defineComponent({
	name: "AddPreview",
	components: {
		VideoQueueItem,
		AddPreviewHelper,
	},
	setup() {
		const store = useStore();
		const { t } = useI18n();
		const route = useRoute();

		const videos: Ref<Video[]> = ref([]);
		const isLoadingAddPreview = ref(false);
		const hasAddPreviewFailed = ref(false);
		const inputAddPreview = ref("");
		const isLoadingAddAll = ref(false);
		const videosLoadFailureText = ref("");

		const testVideos = import.meta.env.DEV
			? [
					["test youtube 0", "https://www.youtube.com/watch?v=IG2JF0P4GFA"],
					["test youtube 1", "https://www.youtube.com/watch?v=LP8GRjv6AIo"],
					["test youtube w/ captions", "https://www.youtube.com/watch?v=xco0qjszPHQ"],
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
					[
						"test hls 1",
						"https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
					],
					[
						"test dash 0",
						"https://dash.akamaized.net/dash264/TestCases/1a/sony/SNE_DASH_SD_CASE1A_REVISED.mpd",
					],
					["test dash 1", "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd"],
					["test peertube 0", "https://the.jokertv.eu/w/7C5YZTLVudL4FLN4JmVvnA"],
			  ]
			: [];

		// HACK: The @change event only triggers when the text field is defocused.
		// This ensures that onInputAddPreviewChange() runs everytime the text field's value changes.
		watch(inputAddPreview, () => {
			// HACK: ensure that inputAddPreview always a string
			if (inputAddPreview.value === null) {
				inputAddPreview.value = "";
			}
			onInputAddPreviewChange();
		});

		const highlightedAddPreviewItem = computed(() => {
			return _.find(videos.value, { highlight: true });
		});
		const isAddPreviewInputUrl = computed(() => {
			try {
				return !!new URL(inputAddPreview.value).host;
			} catch (e) {
				return false;
			}
		});
		const production = computed(() => {
			/**
			 * This is used so we can test for development/production only behavior in unit tests.
			 * Do not change.
			 */
			return store.state.production;
		});

		async function requestAddPreview() {
			try {
				const res = await API.get<OttResponseBody<OttApiResponseAddPreview>>(
					`/data/previewAdd?input=${encodeURIComponent(inputAddPreview.value)}`
				);

				hasAddPreviewFailed.value = false;
				if (res.data.success) {
					videos.value = res.data.result;
					console.log(`Got add preview with ${videos.value.length}`);
				} else {
					throw new Error(res.data.error.message);
				}
			} catch (err) {
				hasAddPreviewFailed.value = true;
				videosLoadFailureText.value = t("add-preview.messages.unknown-error");
				console.error("Failed to get add preview", err);
				if (axios.isAxiosError(err) && err.response) {
					console.error(
						`add preview response: ${err.response.status}`,
						err.response.data
					);

					if (err.response.status === 400) {
						videosLoadFailureText.value = err.response.data.error.message;
						if (
							err.response.data.error.name === "FeatureDisabledException" &&
							!isAddPreviewInputUrl.value
						) {
							window.open(
								`https://www.youtube.com/results?search_query=${encodeURIComponent(
									inputAddPreview.value
								)}`,
								"_blank"
							);
						}
					}
				}

				toast.add({
					style: ToastStyle.Error,
					content: t("add-preview.messages.failed-to-get-add-preview"),
					duration: 6000,
				});
			} finally {
				isLoadingAddPreview.value = false;
			}
		}
		const requestAddPreviewDebounced = _.debounce(requestAddPreview, 1000);
		/**
		 * Request an add preview regardless of the current input.
		 */
		async function requestAddPreviewExplicit() {
			isLoadingAddPreview.value = true;
			hasAddPreviewFailed.value = false;
			videos.value = [];
			await requestAddPreview();
		}
		async function addAllToQueue() {
			isLoadingAddAll.value = true;
			try {
				await API.post(`/room/${route.params.roomId}/queue`, { videos: videos.value });
			} catch (err) {
				let message = `${err}`;
				if (err.response) {
					message = `${err.response.data.error.message}`;
				}
				toast.add({
					style: ToastStyle.Error,
					content: t("add-preview.messages.failed-to-all-videos", {
						message: message,
					}),
					duration: 4000,
				});
			}
			isLoadingAddAll.value = false;
		}
		function onInputAddPreviewChange() {
			hasAddPreviewFailed.value = false;
			if (!inputAddPreview.value || _.trim(inputAddPreview.value).length === 0) {
				videos.value = [];
				return;
			}
			if (!isAddPreviewInputUrl.value) {
				videos.value = [];
				// Don't send API requests for non URL inputs without the user's explicit input to do so.
				// This is to help conserve youtube API quota.
				return;
			}
			isLoadingAddPreview.value = true;
			videos.value = [];
			requestAddPreviewDebounced();
		}
		function onInputAddPreviewKeyDown(e) {
			if (e.keyCode === 13) {
				e.preventDefault();
			}

			if (_.trim(inputAddPreview.value).length === 0 || isAddPreviewInputUrl.value) {
				return;
			}

			if (e.keyCode === 13 && videos.value.length === 0) {
				requestAddPreviewExplicit();
			}
		}

		function onFocusHighlightText(e) {
			e.target.select();
		}
		function setAddPreviewText(text: string) {
			inputAddPreview.value = text;
		}

		return {
			videos,
			isLoadingAddPreview,
			hasAddPreviewFailed,
			inputAddPreview,
			isLoadingAddAll,
			videosLoadFailureText,
			testVideos,

			highlightedAddPreviewItem,
			isAddPreviewInputUrl,
			production,

			requestAddPreview,
			requestAddPreviewDebounced,
			requestAddPreviewExplicit,
			addAllToQueue,
			onInputAddPreviewChange,
			onInputAddPreviewKeyDown,
			onFocusHighlightText,
			setAddPreviewText,
		};
	},
});

export default AddPreview;
</script>

<style lang="scss" scoped>
.video-add {
	margin: 20px 30px;
	min-height: 500px;
}

.video-list {
	margin-top: 24px;
	justify-content: center;
}
</style>
