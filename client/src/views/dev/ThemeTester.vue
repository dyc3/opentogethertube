<template>
	<div>
		<div class="mx-auto max-w-6xl px-6 py-8">
			<span class="label-mono text-signal">Dev</span>
			<h1 class="font-display text-4xl tracking-wide">Themes</h1>
		</div>
		<div
			v-for="theme in themes"
			:key="theme"
			:data-theme="theme"
			class="theme-app bg-background text-foreground"
		>
			<div class="mx-auto max-w-6xl px-6 py-8">
				<h3 class="font-display text-2xl tracking-wide text-primary">{{ theme }}</h3>

				<span class="label-mono mt-4 block text-muted-foreground">
					Video Controls (outside video)
				</span>
				<VideoControls
					mode="outside-video"
					:controls-visible="true"
					:slider-position="5"
					:true-position="5"
					:player="null"
				/>

				<span class="label-mono mt-4 block text-muted-foreground">
					Video Controls (in video)
				</span>

				<div class="dummy-video"></div>
				<VideoControls
					mode="in-video"
					:controls-visible="true"
					:slider-position="5"
					:true-position="5"
					:player="null"
				/>

				<Card class="mt-6">
					<CardHeader>
						<CardTitle>Card</CardTitle>
					</CardHeader>
					<CardFooter class="gap-2">
						<Button variant="default">Primary</Button>
						<Button variant="outline">Default</Button>
					</CardFooter>
				</Card>

				<span class="label-mono mt-6 block text-muted-foreground">Buttons</span>
				<div class="mt-2 flex flex-wrap gap-2">
					<Button variant="default">Primary</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="signal">Warning</Button>
					<Button variant="outline">Default</Button>
				</div>

				<span class="label-mono mt-6 block text-muted-foreground">Toasts</span>
				<div class="mt-2 flex flex-col gap-2">
					<ToastNotification
						v-for="toast in dummyToasts"
						:key="toast.content"
						:toast="toast"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { onMounted } from "vue";
import { Theme } from "@/stores/settings";
import VideoControls from "@/components/controls/VideoControls.vue";
import { useStore } from "@/store";
import ToastNotification from "@/components/ToastNotification.vue";
import { type Toast, ToastStyle } from "@/models/toast";
import { enumKeys } from "@/util/misc";

const store = useStore();
const themes = Object.values(Theme);
// TODO: set type to ServerMessageSync
const dummyRoomSync = {
	action: "sync",
	name: "foo",
	playbackPosition: 5,
	playbackSpeed: 1,
	currentSource: {
		service: "youtube",
		id: "dQw4w9WgXcQ",
		length: 20,
	},
	videoSegments: [
		{
			UUID: "foo",
			startTime: 0.5,
			endTime: 1,
			category: "intro",
			videoDuration: 20,
		},
		{
			UUID: "bar",
			startTime: 2,
			endTime: 3,
			category: "sponsor",
			videoDuration: 20,
		},
	],
};

class DummyTimeRanges implements TimeRanges {
	ranges = [
		{
			start: 0,
			end: 6,
		},
		{
			start: 13,
			end: 16,
		},
	];

	get length(): number {
		return this.ranges.length;
	}

	start(index: number): number {
		if (index >= this.ranges.length || index < 0) {
			return 0;
		}
		return this.ranges[index].start;
	}

	end(index: number): number {
		if (index >= this.ranges.length || index < 0) {
			return 0;
		}
		return this.ranges[index].end;
	}
}
const dummyBufferSpans = new DummyTimeRanges();

const dummyToasts: Toast[] = enumKeys(ToastStyle).map(style => ({
	id: Symbol("toast"),
	style: ToastStyle[style],
	content: `${style} toast`,
}));

onMounted(() => {
	store.dispatch("sync", dummyRoomSync);
	store.commit("PLAYBACK_BUFFER_SPANS", dummyBufferSpans);
});
</script>

<style scoped>
.theme-app {
	min-height: fit-content;
	border-bottom: 1px solid var(--line-strong);
}

.dummy-video {
	width: 100%;
	height: 120px;
	background-color: #000;
}
</style>
