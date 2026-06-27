import { onBeforeUnmount, type Ref, ref } from "vue";
import ASS from "assjs";

/**
 * Manages an assjs subtitle overlay rendered on top of an HTML5 video element.
 *
 * assjs derives its reference resolution (`layoutRes`) exactly once, in its
 * constructor — from the ASS file's `LayoutResX/Y`, else `video.videoWidth/Height`,
 * else the element's *displayed* pixel size — and never revisits it (it only
 * recomputes the subtitle box afterwards via its own ResizeObserver). So
 * constructing before the video's metadata has loaded (while `videoWidth` is 0)
 * locks the subtitles to the element's display aspect ratio, with nothing to
 * correct it later. We avoid the race by waiting for the intrinsic dimensions to be
 * known before constructing the instance.
 *
 * Overlapping loads are disambiguated by a monotonic `loadSeq`: each load claims
 * an id and applies its result only if still the latest, so a slow earlier fetch
 * can't clobber a newer one even when both target the same url.
 */
export function useAssOverlay(
	videoElement: Ref<HTMLVideoElement | undefined>,
	container: Ref<HTMLElement | undefined>,
) {
	let instance: ASS | null = null;
	// The active or in-flight track; drives the fast path/dedupe. Null when none.
	let currentUrl: string | null = null;
	// Monotonic load id, bumped per load() and on teardown.
	let loadSeq = 0;
	const visible = ref(false);
	// Cleanup for a pending waitForDimensions() listener, so teardown can cancel it.
	let cancelWait: (() => void) | null = null;

	/**
	 * Resolve once the video's intrinsic dimensions are known (see the module note
	 * above on why assjs must be constructed only after that).
	 */
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
			// loadedmetadata fires when intrinsic dimensions first become known;
			// resize covers a source/quality switch that changes them.
			video.addEventListener("loadedmetadata", onReady);
			video.addEventListener("resize", onReady);
			// Let teardown abort the wait; the seq check in fetchAndCreate then bails.
			cancelWait = () => {
				cleanup();
				resolve();
			};
		});
	}

	function destroy(): void {
		loadSeq++; // invalidate any in-flight load
		cancelWait?.();
		instance?.destroy();
		instance = null;
		currentUrl = null;
		visible.value = false;
	}

	async function fetchAndCreate(
		url: string,
		video: HTMLVideoElement,
		box: HTMLElement,
	): Promise<void> {
		const seq = ++loadSeq; // claim an id before the first await
		currentUrl = url;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const content = await response.text();
			if (seq !== loadSeq) {
				console.warn("useAssOverlay: discarding stale ASS load for", url);
				return;
			}
			// Don't build the overlay until the video resolution is known, or assjs
			// will lock its subtitle scale to the element's display size.
			await waitForDimensions(video);
			if (seq !== loadSeq) {
				console.warn("useAssOverlay: discarding stale ASS load for", url);
				return;
			}
			instance = new ASS(content, video, { container: box });
			visible.value = true;
		} catch (e) {
			if (seq !== loadSeq) {
				console.info("useAssOverlay: ignoring superseded ASS load failure for", url);
				return;
			}
			console.error("useAssOverlay: failed to load ASS subtitles:", e);
			currentUrl = null; // free the slot so this track can be retried
		}
	}

	/**
	 * Load and display the ASS track at `url`. If it's already the active (or
	 * in-flight) track this is a no-op beyond ensuring visibility; switching to a
	 * different url tears down the current overlay and supersedes any in-flight
	 * load via the `loadSeq` token.
	 */
	function load(url: string): Promise<void> {
		const video = videoElement.value;
		const box = container.value;
		if (!video || !box) {
			throw new Error("useAssOverlay.load() called before the video element was mounted");
		}
		if (currentUrl === url) {
			if (instance) {
				console.info("useAssOverlay: track already active, ensuring visible:", url);
				show();
			} else {
				console.info("useAssOverlay: track already loading:", url);
			}
			return Promise.resolve();
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
