import { onBeforeUnmount, type Ref, ref } from "vue";
import ASS from "assjs";

export function useAssOverlay(
	videoElement: Ref<HTMLVideoElement | undefined>,
	container: Ref<HTMLElement | undefined>,
) {
	let instance: ASS | null = null;
	let currentUrl: string | null = null;
	let loadSeq = 0;
	const visible = ref(false);
	let cancelWait: (() => void) | null = null;

	function waitForDimensions(video: HTMLVideoElement): Promise<void> {
		if (video.videoWidth > 0 && video.videoHeight > 0) {
			return Promise.resolve();
		}
		return new Promise<void>(resolve => {
			const cleanup = (): void => {
				video.removeEventListener("loadedmetadata", onReady);
				video.removeEventListener("resize", onReady);
				cancelWait = null;
			};
			const onReady = (): void => {
				if (video.videoWidth > 0 && video.videoHeight > 0) {
					cleanup();
					resolve();
				}
			};
			video.addEventListener("loadedmetadata", onReady);
			video.addEventListener("resize", onReady);
			cancelWait = () => {
				cleanup();
				resolve();
			};
		});
	}

	function destroy(): void {
		loadSeq++;
		cancelWait?.();
		instance?.destroy();
		instance = null;
		currentUrl = null;
		visible.value = false;
	}

	// Returns whether the overlay is now active; failures are logged and reported as false, not thrown.
	async function fetchAndCreate(
		url: string,
		video: HTMLVideoElement,
		box: HTMLElement,
	): Promise<boolean> {
		const seq = ++loadSeq;
		currentUrl = url;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const content = await response.text();
			if (seq !== loadSeq) {
				console.debug("useAssOverlay: ASS load superseded after fetch, ignoring:", url);
				return false;
			}
			await waitForDimensions(video);
			if (seq !== loadSeq) {
				console.debug(
					"useAssOverlay: ASS load superseded while awaiting video dimensions, ignoring:",
					url,
				);
				return false;
			}
			// assjs attaches a ResizeObserver to the video element, so subtitles keep rendering
			// at the correct position when the video's dimensions change.
			instance = new ASS(content, video, { container: box });
			visible.value = true;
			return true;
		} catch (e) {
			if (seq !== loadSeq) {
				console.debug("useAssOverlay: superseded ASS load failed, ignoring:", url, e);
				return false;
			}
			console.error("useAssOverlay: failed to load ASS subtitles:", url, e);
			currentUrl = null;
			return false;
		}
	}

	function load(url: string): Promise<boolean> {
		const video = videoElement.value;
		const box = container.value;
		if (!video || !box) {
			console.error("useAssOverlay: load() called before the video element was mounted");
			return Promise.resolve(false);
		}
		if (currentUrl === url) {
			if (instance) {
				show();
			}
			return Promise.resolve(true);
		}
		destroy();
		return fetchAndCreate(url, video, box);
	}

	function show(): void {
		if (!instance) {
			console.warn("useAssOverlay: show() called with no active overlay");
			return;
		}
		instance.show();
		visible.value = true;
	}

	function hide(): void {
		instance?.hide();
		visible.value = false;
	}

	onBeforeUnmount(destroy);

	return { load, show, hide, destroy, visible };
}
