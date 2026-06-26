<template>
	<div class="video ticket-notch">
		<div class="img-container">
			<img
				:src="thumbnailSource"
				class="thumbnail"
				loading="lazy"
				@error="onThumbnailError"
			/>
			<span
				class="drag-handle"
				v-if="
					!isPreview &&
					store.state.room.queueMode !== QueueMode.Vote &&
					granted('manage-queue.order')
				"
			>
				<Icon :icon="mdiFormatAlignJustify" class="size-5" />
			</span>
			<span class="video-length font-mono">{{ videoLength }}</span>
		</div>
		<div class="meta-container">
			<div>
				<div class="video-title">{{ item.title }}</div>
				<div class="description">{{ item.description }}</div>
				<div v-if="item.service === 'googledrive'" class="experimental">
					{{ $t("video-queue-item.experimental") }}
				</div>
				<span v-if="item.startAt !== undefined" class="video-start-at">
					{{ $t("video-queue-item.start-at", { timestamp: videoStartAt }) }}
				</span>
			</div>
		</div>
		<div style="display: flex; justify-content: center; flex-direction: column">
			<div class="button-container" v-if="!hideAllButtons">
				<Button
					class="button-with-icon"
					:variant="voted ? 'destructive' : 'signal'"
					size="sm"
					@click="vote"
					:disabled="isLoadingVote"
					v-if="!isPreview && store.state.room.queueMode === QueueMode.Vote"
					data-cy="btn-vote"
				>
					<Spinner v-if="isLoadingVote" class="size-4" />
					<template v-else>
						<span>{{ votes }}</span>
						<Icon :icon="mdiThumbUp" class="size-4" />
						<span class="vote-text">
							{{ voted ? $t("common.unvote") : $t("common.vote") }}
						</span>
					</template>
				</Button>
				<Tooltip v-if="store.state.room.queueMode !== QueueMode.Vote">
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							@click="playNow"
							:disabled="!granted('manage-queue.play-now')"
							data-cy="btn-play-now"
							:aria-label="$t('video.playnow')"
						>
							<Icon :icon="mdiPlay" class="size-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{{ $t("video.playnow-explanation") }}</TooltipContent>
				</Tooltip>
				<Tooltip v-if="isPreview && store.state.room.queueMode !== QueueMode.Dj">
					<TooltipTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							:disabled="isLoadingAdd"
							@click="addToQueue"
							data-cy="btn-add-to-queue"
							:aria-label="$t('video.add-to-queue')"
						>
							<Spinner v-if="isLoadingAdd" class="size-4" />
							<Icon
								v-else-if="hasError"
								:icon="mdiExclamation"
								class="size-5 text-destructive"
							/>
							<Icon
								v-else-if="hasBeenAdded"
								:icon="mdiCheckBold"
								class="size-5 text-success"
							/>
							<Icon v-else :icon="mdiPlus" class="size-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{{ $t("video.add-explanation") }}</TooltipContent>
				</Tooltip>
				<Button
					variant="ghost"
					size="icon"
					:disabled="isLoadingAdd"
					v-if="!isPreview && store.state.room.queueMode !== QueueMode.Dj"
					@click="removeFromQueue"
					data-cy="btn-remove-from-queue"
					:aria-label="$t('video.remove-from-queue')"
				>
					<Spinner v-if="isLoadingAdd" class="size-4" />
					<Icon
						v-else-if="hasError"
						:icon="mdiExclamation"
						class="size-5 text-destructive"
					/>
					<Icon v-else :icon="mdiTrashCan" class="size-5" />
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger as-child>
						<Button
							variant="ghost"
							size="icon"
							data-cy="btn-menu"
							:aria-label="$t('video.more-actions')"
						>
							<Icon :icon="mdiDotsVertical" class="size-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							@click="playNow"
							v-if="store.state.room.queueMode !== QueueMode.Vote"
							:disabled="!granted('manage-queue.play-now')"
							data-cy="menu-btn-play-now"
						>
							<Icon :icon="mdiPlay" class="size-4" />
							<span>{{ $t("video.playnow") }}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							@click="showEditDialog = true"
							data-cy="menu-btn-edit-preview"
						>
							<Icon :icon="mdiPencil" class="size-4" />
							<span>{{ $t("video-queue-item.edit.tooltip") }}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							@click="moveToTop"
							v-if="
								!isPreview &&
								store.state.room.queueMode !== QueueMode.Vote &&
								store.state.room.queueMode !== QueueMode.Dj
							"
							data-cy="menu-btn-move-to-top"
						>
							<Icon :icon="mdiSortDescending" class="size-4" />
							<span>{{ $t("video-queue-item.play-next") }}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							@click="moveToBottom"
							v-if="!isPreview && store.state.room.queueMode !== QueueMode.Vote"
							data-cy="menu-btn-move-to-bottom"
						>
							<Icon :icon="mdiSortAscending" class="size-4" />
							<span>{{ $t("video-queue-item.play-last") }}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							v-if="isPreview && store.state.room.queueMode === QueueMode.Dj"
							@click="addToQueue"
							data-cy="menu-btn-add-to-queue"
						>
							<Icon v-if="hasError" :icon="mdiExclamation" class="size-4" />
							<Icon v-else-if="hasBeenAdded" :icon="mdiCheckBold" class="size-4" />
							<Icon v-else :icon="mdiPlus" class="size-4" />
							<span>{{ $t("common.add") }}</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							@click="removeFromQueue"
							v-if="!isPreview && store.state.room.queueMode === QueueMode.Dj"
							data-cy="menu-btn-remove-from-queue"
						>
							<Icon :icon="mdiTrashCan" class="size-4" />
							<span>{{ $t("common.remove") }}</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
		<Dialog v-model:open="showEditDialog" data-cy="edit-preview-dialog">
			<DialogContent class="max-w-[480px] sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle class="font-display text-2xl tracking-wide">
						{{ $t("video-queue-item.edit.title") }}
					</DialogTitle>
				</DialogHeader>
				<Field v-if="isManifestItem">
					<FieldLabel for="edit-default-subtitle-track">
						{{ $t("video-queue-item.edit.default-subtitle-track") }}
					</FieldLabel>
					<Spinner v-if="isLoadingManifest" class="size-4" />
					<FieldDescription v-else-if="manifestError">
						{{ $t("video-queue-item.edit.manifest-load-failed") }}
					</FieldDescription>
					<Select v-else v-model="editedDefaultTrack">
						<SelectTrigger
							id="edit-default-subtitle-track"
							data-cy="edit-default-subtitle-track"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem :value="TRACK_MANIFEST_DEFAULT">
								{{ $t("video-queue-item.edit.manifest-default") }}
							</SelectItem>
							<SelectItem :value="TRACK_NONE">
								{{ $t("video-queue-item.edit.no-subtitles") }}
							</SelectItem>
							<SelectItem
								v-for="track in manifestTracks"
								:key="track.url"
								:value="track.url"
							>
								{{ formatTrackLabel(track) }}
							</SelectItem>
						</SelectContent>
					</Select>
					<FieldDescription v-if="!manifestError">
						{{ $t("video-queue-item.edit.default-subtitle-track-hint") }}
					</FieldDescription>
				</Field>
				<Field v-else>
					<FieldLabel for="edit-subtitle-url">
						{{ $t("video-queue-item.edit.subtitle-url") }}
					</FieldLabel>
					<Input
						id="edit-subtitle-url"
						v-model="editedSubtitleUrl"
						class="font-mono"
						:disabled="!['direct', 'googledrive'].includes(item.service)"
						data-cy="edit-subtitle-url"
					/>
					<FieldDescription>
						{{ $t("video-queue-item.edit.subtitle-url-supported-services") }}
					</FieldDescription>
				</Field>
				<DialogFooter>
					<Button variant="ghost" @click="showEditDialog = false" data-cy="edit-cancel">
						{{ $t("common.cancel") }}
					</Button>
					<Button :disabled="isLoadingEdit" @click="saveEdit" data-cy="edit-save">
						<Spinner v-if="isLoadingEdit" class="size-4" />
						{{ $t("common.save") }}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	mdiFormatAlignJustify,
	mdiThumbUp,
	mdiPlay,
	mdiExclamation,
	mdiCheckBold,
	mdiPlus,
	mdiTrashCan,
	mdiDotsVertical,
	mdiSortDescending,
	mdiSortAscending,
	mdiPencil,
} from "@mdi/js";
import { ref, toRefs, computed, watch, watchEffect } from "vue";
import { API } from "@/common-http";
import { secondsToTimestamp } from "@/util/timestamp";
import { ToastStyle } from "@/models/toast";
import type { QueueItem, VideoAdd } from "ott-common/models/video";
import type { CustomMediaManifest, CustomMediaTextTrack } from "ott-common/models/zod-schemas";
import { QueueMode } from "ott-common/models/types";
import { useStore } from "@/store";
import toast from "@/util/toast";
import placeholderUrl from "@/assets/placeholder.svg";
import { useI18n } from "vue-i18n";
import axios, { type AxiosResponse } from "axios";
import { useRoomApi } from "@/util/roomapi";
import { useConnection } from "@/plugins/connection";
import type { OttResponseBody } from "ott-common/models/rest-api";
import { useGrants } from "./composables/grants";

interface VideoQueueItemProps {
	item: QueueItem;
	isPreview: boolean;
	hideAllButtons: boolean;
	index?: number;
}

const props = withDefaults(defineProps<VideoQueueItemProps>(), {
	isPreview: false,
	hideAllButtons: false,
});

const { item, index } = toRefs(props);
const store = useStore();
const { t } = useI18n();
const roomapi = useRoomApi(useConnection());
const granted = useGrants();

const isLoadingAdd = ref(false);
const isLoadingVote = ref(false);
const isLoadingEdit = ref(false);
const hasBeenAdded = ref(false);
const thumbnailHasError = ref(false);
const hasError = ref(false);
const voted = ref(false);
const showEditDialog = ref(false);
const editedSubtitleUrl = props.isPreview ? ref("") : ref(item.value.subtitleUrl);

// Sentinel values for the default subtitle track select. `null`/absent on the queue
// item means "use the manifest's default flag", `""` means "no subtitles".
const TRACK_MANIFEST_DEFAULT = "\0manifest-default";
const TRACK_NONE = "\0none";
const isManifestItem = computed(() => item.value.mime === "application/json");
const editedDefaultTrack = ref(TRACK_MANIFEST_DEFAULT);
const manifestTracks = ref<CustomMediaTextTrack[]>([]);
const manifestError = ref(false);
const isLoadingManifest = ref(false);

function trackToSelectValue(track: string | null | undefined): string {
	if (track === null || track === undefined) {
		return TRACK_MANIFEST_DEFAULT;
	}
	if (track === "") {
		return TRACK_NONE;
	}
	return track;
}

function selectValueToTrack(value: string): string | null {
	if (value === TRACK_MANIFEST_DEFAULT) {
		return null;
	}
	if (value === TRACK_NONE) {
		return "";
	}
	return value;
}

function formatTrackLabel(track: CustomMediaTextTrack): string {
	const name = track.name ?? track.srclang;
	const format = track.contentType === "text/x-ass" ? "ASS" : "VTT";
	return `${name} [${track.srclang}] (${format})`;
}

async function loadManifestTracks() {
	isLoadingManifest.value = true;
	manifestError.value = false;
	try {
		const response = await fetch(item.value.src_url ?? item.value.id);
		if (!response.ok) {
			throw new Error(`failed to fetch manifest: ${response.status}`);
		}
		const manifest = (await response.json()) as CustomMediaManifest;
		manifestTracks.value = manifest.textTracks ?? [];
	} catch (e) {
		console.error("VideoQueueItem: failed to load manifest tracks:", e);
		manifestError.value = true;
		manifestTracks.value = [];
	}
	isLoadingManifest.value = false;
}
const videoLength = computed(() => secondsToTimestamp(item.value?.length ?? 0));
const videoStartAt = computed(() => secondsToTimestamp(item.value?.startAt ?? 0));
const thumbnailSource = computed(() => {
	return !thumbnailHasError.value && item.value.thumbnail ? item.value.thumbnail : placeholderUrl;
});
const votes = computed(() => {
	const store = useStore();
	return store.state.room.voteCounts?.get(item.value.service + item.value.id) ?? 0;
});

function updateHasBeenAdded() {
	if (
		store.state.room.currentSource &&
		item.value.id === store.state.room.currentSource.id &&
		item.value.service === store.state.room.currentSource.service
	) {
		hasBeenAdded.value = true;
		return;
	}
	for (const video of store.state.room.queue) {
		if (item.value.id === video.id && item.value.service === video.service) {
			hasBeenAdded.value = true;
			return;
		}
	}
	hasBeenAdded.value = false;
}

function getPostData(): VideoAdd {
	const data: VideoAdd = {
		service: item.value.service,
		id: item.value.id,
		// Use `item.value.*` for preview since the edited refs might not be saved yet
		subtitleUrl:
			(props.isPreview ? item.value.subtitleUrl : editedSubtitleUrl.value) ?? undefined,
		defaultSubtitleTrack: props.isPreview
			? item.value.defaultSubtitleTrack
			: selectValueToTrack(editedDefaultTrack.value),
	};
	return data;
}

// Ensure that the edited values reflect the current item state when the dialog opens
watch(showEditDialog, open => {
	if (!open) {
		return;
	}
	if (!props.isPreview) {
		editedSubtitleUrl.value = item.value.subtitleUrl ?? "";
	}
	editedDefaultTrack.value = trackToSelectValue(item.value.defaultSubtitleTrack);
	if (isManifestItem.value) {
		loadManifestTracks();
	}
});

async function saveEdit() {
	if (props.isPreview) {
		// Update the subtitle settings for playNow()
		item.value.subtitleUrl = editedSubtitleUrl.value ?? undefined;
		item.value.defaultSubtitleTrack = selectValueToTrack(editedDefaultTrack.value);
		showEditDialog.value = false;
	} else {
		isLoadingEdit.value = true;
		try {
			const resp = await API.patch(`/room/${store.state.room.name}/queue`, getPostData());
			hasError.value = !resp.data.success;
			showEditDialog.value = false;
			toast.add({
				style: ToastStyle.Success,
				content: t("video-queue-item.messages.video-updated").toString(),
				duration: 5000,
			});
		} catch (e) {
			hasError.value = true;
			if (axios.isAxiosError(e)) {
				toast.add({
					style: ToastStyle.Error,
					content: e.response?.data.error.message,
					duration: 6000,
				});
			}
		}
		isLoadingEdit.value = false;
	}
}

async function addToQueue() {
	isLoadingAdd.value = true;
	try {
		const resp = await API.post(`/room/${store.state.room.name}/queue`, getPostData());
		hasError.value = !resp.data.success;
		hasBeenAdded.value = true;
		toast.add({
			style: ToastStyle.Success,
			content: t("video-queue-item.messages.video-added").toString(),
			duration: 5000,
		});
	} catch (e) {
		hasError.value = true;
		if (axios.isAxiosError(e)) {
			toast.add({
				style: ToastStyle.Error,
				content: e.response?.data.error.message,
				duration: 6000,
			});
		}
	}
	isLoadingAdd.value = false;
}

async function removeFromQueue() {
	isLoadingAdd.value = true;
	try {
		const resp = await API.delete(`/room/${store.state.room.name}/queue`, {
			data: getPostData(),
		});
		hasError.value = !resp.data.success;
		toast.add({
			style: ToastStyle.Success,
			content: t("video-queue-item.messages.video-removed").toString(),
			duration: 5000,
		});
	} catch (e) {
		hasError.value = true;
		if (axios.isAxiosError(e)) {
			toast.add({
				style: ToastStyle.Error,
				content: e.response?.data.error.message,
				duration: 6000,
			});
		}
	}
	isLoadingAdd.value = false;
}

async function vote() {
	isLoadingVote.value = true;
	try {
		let resp: AxiosResponse<OttResponseBody>;
		if (!voted.value) {
			resp = await API.post(`/room/${store.state.room.name}/vote`, getPostData());
			voted.value = true;
		} else {
			resp = await API.delete(`/room/${store.state.room.name}/vote`, {
				data: getPostData(),
			});
			voted.value = false;
		}
		hasError.value = !resp.data.success;
	} catch (e) {
		hasError.value = true;
		toast.add({
			style: ToastStyle.Error,
			content: e.response.data.error.message,
			duration: 6000,
		});
	}
	isLoadingVote.value = false;
}

function playNow() {
	roomapi.playNow(item.value);
}

/**
 * Moves the video to the top of the queue.
 */
function moveToTop() {
	roomapi.queueMove(index.value ?? 0, 0);
}

/**
 * Moves the video to the bottom of the queue.
 */
function moveToBottom() {
	roomapi.queueMove(
		index.value ?? store.state.room.queue.length - 1,
		store.state.room.queue.length - 1,
	);
}

function onThumbnailError() {
	thumbnailHasError.value = true;
}

watchEffect(() => {
	updateHasBeenAdded();
});
</script>

<style lang="scss" scoped>
$sm-max: 600px;

.video {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: stretch;
	justify-content: space-between;
	width: 100%;
	max-height: 111px;
	margin-top: 8px;
	padding: 4px;
	background: var(--card);
	border: 1px solid var(--line);
	border-left: 3px solid var(--primary);
	transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

	&:hover {
		background: var(--surface-2);
		border-color: color-mix(in srgb, var(--primary) 50%, transparent);
		box-shadow: var(--glow-primary);

		.drag-handle {
			opacity: 1;
		}
	}

	> * {
		display: flex;
	}

	.meta-container {
		flex-grow: 1;
		margin: 0 10px;
		align-items: center;

		> div {
			flex-direction: column;
			width: 100%;
		}
		min-width: 20%;
		width: 30%;

		.video-title {
			font-family: var(--font-display);
			font-size: 1.4rem;
			letter-spacing: 0.01em;
			line-height: 1.1;
			color: var(--foreground);
			@media (max-width: $sm-max) {
				font-size: 0.95rem;
			}
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.experimental {
			font-size: 0.7rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--warning, var(--primary));
			@media (max-width: $sm-max) {
				font-size: 0.6rem;
			}
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.description {
			flex-grow: 1;
			font-size: 0.85rem;
			color: var(--muted-foreground);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;

			@media (max-width: $sm-max) {
				display: none;
			}
		}
	}

	.img-container {
		position: relative;
		width: 200px;
		max-width: 200px;
		overflow: hidden;
		border-radius: 2px;
		@media (max-width: $sm-max) {
			max-width: 80px;
		}
	}

	.thumbnail {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 1.8;
		object-fit: cover;
	}

	.button-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		flex-wrap: nowrap;
		gap: 4px;

		@media (max-width: $sm-max) {
			.vote-text {
				display: none;
			}
		}
	}

	.drag-handle {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		align-items: center;
		width: 40%;
		height: 100%;
		padding-left: 10px;
		color: var(--foreground);
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--ink) 85%, transparent) 0%,
			color-mix(in srgb, var(--ink) 70%, transparent) 40%,
			transparent 100%
		);
		cursor: move;
		opacity: 0;
		transition: opacity 0.4s ease;
		z-index: 2;
	}
}

.button-with-icon {
	gap: 4px;
}

.video-length {
	background: color-mix(in srgb, var(--ink) 85%, transparent);
	color: var(--foreground);
	font-size: 0.7rem;
	padding: 2px 6px;
	border-top-left-radius: 3px;
	position: absolute;
	bottom: 0;
	right: 0;
	z-index: 1;
}

.video-start-at {
	font-size: 0.85rem;
	@media (max-width: $sm-max) {
		font-size: 0.75rem;
	}
	font-style: italic;
	color: var(--muted-foreground);
}
</style>
