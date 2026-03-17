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
					:prepend-inner-icon="mdiMagnify"
					base-color="primary"
					color="primary"
					persistent-clear
					data-cy="add-preview-input"
				/>
				<v-select
					v-if="showAdapterSelector"
					v-model="selectedAdapter"
					:items="adapterOptions"
					item-title="text"
					item-value="value"
					:label="$t('add-preview.adapter-selector.label')"
					density="compact"
					variant="outlined"
					class="adapter-select"
					data-cy="adapter-selector"
				/>
			</v-sheet>
		</v-row>
		<v-row>
			<v-container v-if="!production" class="test-videos-container">
				<v-chip-group v-model="selectedTestVideo" column mandatory>
					<v-row>
						<v-col
							v-for="(group, groupName) in testVideos"
							:key="groupName"
							cols="12"
							sm="6"
							md="4"
							lg="3"
						>
							<div class="video-group-title">{{ groupName }}</div>
							<v-chip
								v-for="(v, idx) in group"
								:key="`${groupName}-${idx}`"
								:value="`${groupName}-${idx}`"
								@click="inputAddPreview = v[1]"
								data-cy="test-video"
								color="primary"
								variant="outlined"
							>
								{{ v[0] }}
							</v-chip>
						</v-col>
					</v-row>
				</v-chip-group>
			</v-container>
			<v-btn
				v-if="videos.length > 1"
				@click="addAllToQueue()"
				:loading="isLoadingAddAll"
				:disabled="isLoadingAddAll"
				:prepend-icon="mdiPlus"
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
				<v-row style="justify-content: center">
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

<script lang="ts" setup>
import { mdiMagnify, mdiPlus } from "@mdi/js";
import { ref, computed, watch, type Ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "@/store";
import { useI18n } from "vue-i18n";
import { API } from "@/common-http";
import _ from "lodash";
import VideoQueueItem from "@/components/VideoQueueItem.vue";
import { ToastStyle } from "@/models/toast";
import toast from "@/util/toast";
import type { Video } from "ott-common/models/video";
import type { OttResponseBody, OttApiResponseAddPreview } from "ott-common/models/rest-api";
import axios from "axios";
import AddPreviewHelper from "./AddPreviewHelper.vue";
import { ALL_VIDEO_SERVICES } from "ott-common/constants";

const store = useStore();
const { t } = useI18n();
const route = useRoute();

const videos: Ref<Video[]> = ref([]);
const isLoadingAddPreview = ref(false);
const hasAddPreviewFailed = ref(false);
const inputAddPreview = ref("");
const isLoadingAddAll = ref(false);
const videosLoadFailureText = ref("");
const selectedTestVideo = ref<string | undefined>(undefined);
const selectedAdapter = ref<string | null>(null);

const testVideos: Record<string, Array<[string, string]>> = import.meta.env.DEV
	? {
			YouTube: [
				["test youtube 0", "https://www.youtube.com/watch?v=IG2JF0P4GFA"],
				["test youtube 1", "https://www.youtube.com/watch?v=LP8GRjv6AIo"],
				["test youtube w/ captions", "https://www.youtube.com/watch?v=xco0qjszPHQ"],
			],
			Vimeo: [
				["test vimeo 0", "https://vimeo.com/94338566"],
				["test vimeo 1", "https://vimeo.com/239423699"],
			],
			Direct: [
				[
					"test direct 0",
					"https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
				],
				["test direct 1", "https://vjs.zencdn.net/v/oceans.mp4"],
			],
			HLS: [
				[
					"test hls 0",
					"https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
				],
				[
					"test hls 1",
					"https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
				],
				[
					"test hls 2 w/ one quality",
					"https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8",
				],
			],
			DASH: [
				[
					"test dash 0",
					"https://dash.akamaized.net/dash264/TestCases/1a/sony/SNE_DASH_SD_CASE1A_REVISED.mpd",
				],
				["test dash 1", "https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd"],
				[
					"test dash 2 w/ one caption",
					"https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd",
				],
				[
					"test dash 3 w/ multiple captions",
					"https://livesim2.dashif.org/vod/testpic_2s/multi_subs.mpd",
				],
				[
					"test dash 4 w/ multiple qualities",
					"https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
				],
			],
			PeerTube: [["test peertube 0", "https://tube.shanti.cafe/w/96kFpg7fs4LwYkFCMFv51E"]],
			Odysee: [
				["test odysee 0", "https://odysee.com/@RuslanPerezhilo:1/AnimationDemoReel20:d"],
				["test odysee error 0", "https://odysee.com/@rpgDAN:8/Detektive-9:a"],
				[
					"test odysee error 1",
					"https://odysee.com/@Majoo:8/so-sprengst-du-das-neue-kraftwerk-in:f",
				],
			],
	  }
	: {};

// HACK: The @change event only triggers when the text field is defocused.
// This ensures that onInputAddPreviewChange() runs everytime the text field's value changes.
watch(inputAddPreview, () => {
	// HACK: ensure that inputAddPreview always a string
	if (inputAddPreview.value === null) {
		inputAddPreview.value = "";
	}
	if (!production.value) {
		// Deselect chip (of test videos) when input is cleared or doesn't match selected video
		if (inputAddPreview.value === "") {
			selectedTestVideo.value = undefined;
		} else {
			// Check if the current input matches any test video's URL
			selectedTestVideo.value = Object.entries(testVideos).reduce<string | undefined>(
				(found, [groupName, group]) => {
					if (found) {
						return found;
					}
					const index = group.findIndex(v => v[1] === inputAddPreview.value);
					return index !== -1 ? `${groupName}-${index}` : undefined;
				},
				undefined
			);
		}
	}
	onInputAddPreviewChange();
});

const highlightedAddPreviewItem = ref<Video | undefined>(undefined);
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
const showAdapterSelector = computed(() => {
	return store.state.settings.enableAdapterSelector;
});
const adapterOptions = computed(() => {
	return [
		{ text: t("add-preview.adapter-selector.auto"), value: null },
		...ALL_VIDEO_SERVICES.map(service => ({
			text: service,
			value: service,
		})),
	];
});

async function requestAddPreview() {
	try {
		let url = `/data/previewAdd?input=${encodeURIComponent(inputAddPreview.value)}`;
		if (selectedAdapter.value) {
			url += `&adapter=${encodeURIComponent(selectedAdapter.value)}`;
		}
		const res = await API.get<OttResponseBody<OttApiResponseAddPreview>>(url);

		hasAddPreviewFailed.value = false;
		if (res.data.success) {
			videos.value = res.data.result;
			highlightedAddPreviewItem.value = res.data.highlighted;
			console.log(`Got add preview with ${videos.value.length}`);
		} else {
			throw new Error(res.data.error.message);
		}
	} catch (err) {
		hasAddPreviewFailed.value = true;
		videosLoadFailureText.value = t("add-preview.messages.unknown-error");
		console.error("Failed to get add preview", err);
		let unknownFail = true;
		if (axios.isAxiosError(err) && err.response) {
			console.error(`add preview response: ${err.response.status}`, err.response.data);

			if (err.response.status === 400) {
				unknownFail = false;
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
			} else if (err.response.status === 429) {
				unknownFail = false;
				videosLoadFailureText.value = t("common.errors.rate-limited", {
					duration: err.response.headers["Retry-After"],
				});
			}
		}

		if (unknownFail) {
			toast.add({
				style: ToastStyle.Error,
				content: t("add-preview.messages.failed-to-get-add-preview"),
				duration: 6000,
			});
		}
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
	highlightedAddPreviewItem.value = undefined;
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
		highlightedAddPreviewItem.value = undefined;
		return;
	}
	if (!isAddPreviewInputUrl.value) {
		videos.value = [];
		highlightedAddPreviewItem.value = undefined;
		// Don't send API requests for non URL inputs without the user's explicit input to do so.
		// This is to help conserve youtube API quota.
		return;
	}
	isLoadingAddPreview.value = true;
	videos.value = [];
	highlightedAddPreviewItem.value = undefined;
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

.test-videos-container {
	margin-bottom: 12px;
	padding: 12px;

	:deep(.v-chip) {
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-2px);
		}
	}
}

.video-group-title {
	font-weight: 600;
	font-size: 0.875rem;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-bottom: 8px;
	color: rgb(var(--v-theme-primary));
	opacity: 0.8;
}

.adapter-select {
	max-width: 200px;
	margin-top: 8px;
}
</style>
