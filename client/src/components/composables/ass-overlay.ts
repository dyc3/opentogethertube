import { onBeforeUnmount, type Ref, ref } from "vue";
import ASS from "assjs";

/**
 * Manages an assjs subtitle overlay rendered on top of an HTML5 video element.
 *
 * assjs only recomputes its subtitle box when the video element's box size
 * changes (via its own internal ResizeObserver). It does NOT recompute when the
 * video's intrinsic resolution becomes known (metadata load) or changes (quality
 * switch). Since the video element here is always sized 100%x100%, constructing
 * the instance before metadata is available leaves the box positioned as if the
 * video filled the whole container (no letterboxing). We fix this by forcing a
 * recompute on the video element's "resize" event, which fires exactly when the
 * intrinsic dimensions first appear and whenever they change.
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
	let containerObserver: ResizeObserver | null = null;

	/**
	 * Force assjs to recompute its subtitle box. assjs has no public resize() —
	 * the resize logic lives in a private `#resize` only invoked by its internal
	 * ResizeObserver and by the `resampling` setter. That setter early-returns
	 * when the value is unchanged (`if (r === this.#resampling) return;`), so we
	 * toggle to another valid mode and back: each write actually changes the
	 * value, triggering an internal recompute, and the final mode is unchanged.
	 */
	function recompute(): void {
		if (!instance) {
			throw new Error("useAssOverlay: recompute() called with no active overlay");
		}
		const mode = instance.resampling;
		instance.resampling = mode === "video_height" ? "video_width" : "video_height";
		instance.resampling = mode;
	}

	function attachResize(video: HTMLVideoElement, box: HTMLElement): void {
		video.addEventListener("resize", recompute);
		// loadedmetadata fires when intrinsic dimensions become known; it may arrive
		// before the ASS fetch completes, so we re-run recompute here too.
		video.addEventListener("loadedmetadata", recompute);
		containerObserver = new ResizeObserver(() => {
			if (instance) recompute();
		});
		containerObserver.observe(box);
	}

	function detachResize(video: HTMLVideoElement): void {
		video.removeEventListener("resize", recompute);
		video.removeEventListener("loadedmetadata", recompute);
		containerObserver?.disconnect();
		containerObserver = null;
	}

	function destroy(): void {
		loadSeq++; // invalidate any in-flight load

		if (videoElement.value) {
			detachResize(videoElement.value);
		}
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
			instance = new ASS(content, video, { container: box });
			visible.value = true;
			attachResize(video, box);
			// Defer recompute to the next animation frame so the browser has
			// finished layout before assjs reads the video's bounding rect.
			requestAnimationFrame(recompute);
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
