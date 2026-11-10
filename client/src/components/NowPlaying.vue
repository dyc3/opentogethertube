<template>
	<Popover>
		<PopoverTrigger as-child>
			<button
				type="button"
				class="group flex min-w-0 flex-[1_1_16rem] items-center gap-2 rounded-sm px-2 py-1 text-left outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring/60"
				data-cy="now-playing"
			>
				<span class="label-mono shrink-0 text-primary">{{ $t("now-playing.label") }}</span>
				<span class="truncate text-sm text-foreground">{{ title }}</span>
				<Icon
					:icon="mdiChevronDown"
					class="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
				/>
			</button>
		</PopoverTrigger>
		<PopoverContent
			align="start"
			class="w-104 max-w-[calc(100vw-1rem)] gap-3 p-3"
			data-cy="now-playing-details"
		>
			<div class="flex gap-3">
				<img
					v-if="video.thumbnail && !thumbnailHasError"
					:src="video.thumbnail"
					alt=""
					class="aspect-video w-28 shrink-0 self-start rounded-xs object-cover"
					@error="thumbnailHasError = true"
				/>
				<div class="min-w-0">
					<div class="font-display text-xl leading-tight wrap-anywhere">{{ title }}</div>
					<div class="label-mono mt-1 text-muted-foreground">
						{{ video.service }}
						<template v-if="video.length">
							· {{ secondsToTimestamp(video.length) }}
						</template>
					</div>
				</div>
			</div>
			<p
				class="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground wrap-anywhere"
			>
				{{ video.description || $t("now-playing.no-description") }}
			</p>
			<div v-if="sourceUrl" class="flex gap-2">
				<Button as-child variant="outline" size="sm" class="flex-1">
					<a
						:href="sourceUrl"
						target="_blank"
						rel="noopener noreferrer"
						data-cy="now-playing-open-original"
					>
						<Icon :icon="mdiOpenInNew" class="size-4" />
						{{ $t("now-playing.open-original") }}
					</a>
				</Button>
				<Button variant="ghost" size="sm" data-cy="now-playing-copy-link" @click="copyLink">
					<Icon :icon="copied ? mdiCheck : mdiContentCopy" class="size-4" />
					{{ copied ? $t("now-playing.link-copied") : $t("now-playing.copy-link") }}
				</Button>
			</div>
		</PopoverContent>
	</Popover>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { mdiCheck, mdiChevronDown, mdiContentCopy, mdiOpenInNew } from "@mdi/js";
import { useTimeoutFn } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { secondsToTimestamp } from "@/util/timestamp";
import type { QueueItem } from "ott-common/models/video";
import { buildUrlForQueueItem } from "ott-common/queueexport";

const COPIED_FEEDBACK_DURATION = 2000;

const props = defineProps<{ video: QueueItem }>();

const title = computed(() => props.video.title || props.video.id);

const sourceUrl = computed(() => {
	try {
		return buildUrlForQueueItem(props.video);
	} catch {
		// Not every service's videos can be turned back into a link.
		return null;
	}
});

const thumbnailHasError = ref(false);
watch(
	() => props.video.thumbnail,
	() => {
		thumbnailHasError.value = false;
	},
);

const copied = ref(false);
const { start: clearCopiedLater } = useTimeoutFn(
	() => {
		copied.value = false;
	},
	COPIED_FEEDBACK_DURATION,
	{ immediate: false },
);

async function copyLink() {
	if (!sourceUrl.value) {
		return;
	}
	try {
		await navigator.clipboard.writeText(sourceUrl.value);
	} catch (err) {
		console.error("Failed to copy video link", err);
		return;
	}
	copied.value = true;
	clearCopiedLater();
}
</script>
