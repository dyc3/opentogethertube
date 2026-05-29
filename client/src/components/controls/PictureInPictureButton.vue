<template>
	<Tooltip v-if="isBrowserSupported">
		<TooltipTrigger as-child>
			<Button
				variant="ghost"
				size="icon"
				class="media-control"
				:disabled="!isVideoSupported"
				:aria-label="$t('room.pip')"
				@click="togglePictureInPicture()"
			>
				<Icon
					:icon="
						isActive
							? mdiPictureInPictureBottomRight
							: mdiPictureInPictureBottomRightOutline
					"
					class="size-5"
				/>
			</Button>
		</TooltipTrigger>
		<TooltipContent side="bottom">{{ $t("room.pip") }}</TooltipContent>
	</Tooltip>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { mdiPictureInPictureBottomRight, mdiPictureInPictureBottomRightOutline } from "@mdi/js";

const isActive = ref(false);
const currentVideo = ref<HTMLVideoElement | null>(null);
let mutationObserver: MutationObserver | null = null;

const isBrowserSupported = "pictureInPictureElement" in document;
const isVideoSupported = computed(() => {
	// Check if Picture-in-Picture is supported and a video element exists
	// so, iframe videos are not supported
	// Using currentVideo.value to make this reactive to video element changes
	return !!currentVideo.value;
});

function getVideoElement(): HTMLVideoElement | null {
	return document.querySelector("video");
}

function handlePipEnter() {
	isActive.value = true;
}

function handlePipLeave() {
	isActive.value = false;
}

function attachVideoListeners(video: HTMLVideoElement | null) {
	// Remove listeners from previous video element
	if (currentVideo.value) {
		currentVideo.value.removeEventListener("enterpictureinpicture", handlePipEnter);
		currentVideo.value.removeEventListener("leavepictureinpicture", handlePipLeave);
	}

	// Attach listeners to new video element
	if (video) {
		video.addEventListener("enterpictureinpicture", handlePipEnter);
		video.addEventListener("leavepictureinpicture", handlePipLeave);
		// Update isActive state based on current PiP status
		isActive.value = document.pictureInPictureElement === video;
	} else {
		isActive.value = false;
	}

	currentVideo.value = video;
}

function observeVideoElement() {
	const video = getVideoElement();
	if (video !== currentVideo.value) {
		attachVideoListeners(video);
	}
}

onMounted(() => {
	observeVideoElement();

	// Watch for video element changes in the DOM
	mutationObserver = new MutationObserver(() => {
		observeVideoElement();
	});

	// Observe the entire document for added/removed video elements
	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
});

onUnmounted(() => {
	if (currentVideo.value) {
		currentVideo.value.removeEventListener("enterpictureinpicture", handlePipEnter);
		currentVideo.value.removeEventListener("leavepictureinpicture", handlePipLeave);
	}

	if (mutationObserver) {
		mutationObserver.disconnect();
	}
});

async function togglePictureInPicture() {
	const video = getVideoElement();
	if (!video) {
		console.error("No video element found");
		return;
	}

	try {
		if (document.pictureInPictureElement) {
			await document.exitPictureInPicture();
		} else {
			await video.requestPictureInPicture();
		}
	} catch (error) {
		console.error("Failed to toggle Picture-in-Picture:", error);
	}
}
</script>

<style scoped>
.media-control {
	color: var(--foreground);
}
</style>
