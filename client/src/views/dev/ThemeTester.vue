<template>
	<div>
		<v-container>
			<h1>Themes</h1>
		</v-container>
		<div v-for="theme in Theme" :key="theme">
			<v-theme-provider :theme="theme">
				<v-app class="theme-app" style="height: fit-content">
					<v-container>
						<h3>{{ theme }}</h3>

						<span>Video Controls (outside video)</span>
						<VideoControls
							mode="outside-video"
							:controls-visible="true"
							:slider-position="5"
							:true-position="5"
							:player="null"
						/>

						<span>Video Controls (in video)</span>

						<div class="dummy-video"></div>
						<VideoControls
							mode="in-video"
							:controls-visible="true"
							:slider-position="5"
							:true-position="5"
							:player="null"
						/>

						<v-card>
							<v-card-title>Card</v-card-title>
							<v-card-actions>
								<v-btn color="primary">Primary</v-btn>
								<v-btn>Default</v-btn>
							</v-card-actions>
						</v-card>

						<span>Buttons</span>
						<div>
							<v-btn color="primary">Primary</v-btn>
							<v-btn color="secondary">Secondary</v-btn>
							<v-btn color="warning">Warning</v-btn>
							<v-btn>Default</v-btn>
						</div>

						<span>Toasts</span>
						<div>
							<ToastNotification
								v-for="toast in dummyToasts"
								:key="toast.content"
								:toast="toast"
							/>
						</div>
					</v-container>
				</v-app>
			</v-theme-provider>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { Theme } from "@/stores/settings";
import VideoControls from "@/components/controls/VideoControls.vue";
import { useStore } from "@/store";
import ToastNotification from "@/components/ToastNotification.vue";
import { Toast, ToastStyle } from "@/models/toast";
import { enumKeys } from "@/util/misc";

const store = useStore();
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

<style lang="scss">
.theme-app > * {
	min-height: inherit;
}

.dummy-video {
	width: 100%;
	height: 120px;
	background-color: #000;
}
</style>
