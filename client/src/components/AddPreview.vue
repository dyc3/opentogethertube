<template>
	<div class="video-add">
		<div class="search-sheet">
			<div class="relative">
				<Icon
					:icon="mdiMagnify"
					class="pointer-events-none absolute left-3 top-3 size-5 text-primary"
				/>
				<Textarea
					rows="1"
					class="search-input pl-10 font-mono"
					:placeholder="$t('add-preview.placeholder')"
					v-model="inputAddPreview"
					@keydown="onInputAddPreviewKeyDown"
					@focus="onFocusHighlightText"
					data-cy="add-preview-input"
				/>
				<Spinner
					v-if="isLoadingAddPreview"
					class="absolute right-3 top-3 size-5 text-primary"
				/>
			</div>
			<div v-if="showAdapterSelector" class="adapter-select">
				<span class="label-mono mb-1 block text-muted-foreground">
					{{ $t("add-preview.adapter-selector.label") }}
				</span>
				<Select v-model="selectedAdapter" data-cy="adapter-selector">
					<SelectTrigger class="w-full">
						<SelectValue :placeholder="$t('add-preview.adapter-selector.auto')" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem
							v-for="opt in adapterOptions"
							:key="String(opt.value)"
							:value="opt.value as unknown as string"
						>
							{{ opt.text }}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>

		<div class="controls-row">
			<div v-if="!production" class="test-videos-container">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					<div v-for="(group, groupName) in testVideos" :key="groupName">
						<div class="video-group-title label-mono">{{ groupName }}</div>
						<div class="flex flex-wrap gap-1.5">
							<button
								v-for="(v, idx) in group"
								:key="`${groupName}-${idx}`"
								type="button"
								class="test-chip"
								:class="{
									'test-chip--active':
										selectedTestVideo === `${groupName}-${idx}`,
								}"
								@click="inputAddPreview = v[1]"
								data-cy="test-video"
							>
								{{ v[0] }}
							</button>
						</div>
					</div>
				</div>
			</div>
			<Button
				v-if="videos.length > 1"
				variant="marquee"
				@click="addAllToQueue()"
				:disabled="isLoadingAddAll"
			>
				<Spinner v-if="isLoadingAddAll" class="size-4" />
				<Icon v-else :icon="mdiPlus" class="size-4" />
				{{ $t("add-preview.add-all") }}
			</Button>
		</div>

		<div class="video-list" v-if="!isLoadingAddPreview">
			<div v-if="hasAddPreviewFailed" class="text-sm text-destructive">
				{{ videosLoadFailureText }}
			</div>
			<div
				v-if="
					videos.length === 0 &&
					inputAddPreview.length > 0 &&
					!hasAddPreviewFailed &&
					!isAddPreviewInputUrl
				"
				class="flex flex-col items-center gap-3 text-center"
			>
				<span class="text-muted-foreground">
					{{ $t("add-preview.search-for", { search: inputAddPreview }) }}
				</span>
				<Button @click="requestAddPreviewExplicit" data-cy="add-preview-manual-search">
					<Icon :icon="mdiMagnify" class="size-4" />
					{{ $t("common.search") }}
				</Button>
			</div>
			<div v-else-if="inputAddPreview.length === 0" class="flex justify-center">
				<AddPreviewHelper @link-click="setAddPreviewText" />
			</div>
		</div>
		<div v-if="highlightedAddPreviewItem">
			<VideoQueueItem
				:item="highlightedAddPreviewItem"
				is-preview
				style="margin-bottom: 20px"
			/>
			<h4 class="label-mono text-signal">{{ $t("add-preview.playlist") }}</h4>
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
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
					"https://cdn.jsdelivr.net/gh/dyc3/opentogethertube@master/tests/assets/Big_Buck_Bunny_360_10s_1MB.mp4",
				],
				["test direct 1", "https://vjs.zencdn.net/v/oceans.mp4"],
				[
					"test direct 2 (manifest)",
					"https://cdn.jsdelivr.net/gh/dyc3/opentogethertube@master/tests/assets/custom_manifest.json",
				],
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
				undefined,
			);
		}
	}
	onInputAddPreviewChange();
});

const highlightedAddPreviewItem = ref<Video | undefined>(undefined);
const isAddPreviewInputUrl = computed(() => {
	try {
		return !!new URL(inputAddPreview.value).host;
		// biome-ignore lint/correctness/noUnusedVariables: biome migration
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
							inputAddPreview.value,
						)}`,
						"_blank",
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

.search-sheet {
	margin: 8px 0;
	padding: 14px 16px;
	background: var(--surface-2);
	border: 1px solid var(--line-strong);
	border-radius: 4px;
	box-shadow: var(--shadow-panel);
}

.search-input {
	min-height: 44px;
}

.controls-row {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 12px;
	margin-top: 12px;
}

.video-list {
	margin-top: 24px;
}

.test-videos-container {
	flex: 1 1 100%;
	margin-bottom: 12px;
	padding: 4px 0;
}

.video-group-title {
	margin-bottom: 8px;
	color: var(--primary);
}

.test-chip {
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.7rem;
	padding: 3px 8px;
	border-radius: 3px;
	border: 1px solid color-mix(in srgb, var(--primary) 45%, transparent);
	color: var(--primary);
	background: transparent;
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-2px);
		background: color-mix(in srgb, var(--primary) 12%, transparent);
	}

	&--active {
		background: var(--primary);
		color: var(--ink);
	}
}

.adapter-select {
	max-width: 240px;
	margin-top: 8px;
}
</style>
