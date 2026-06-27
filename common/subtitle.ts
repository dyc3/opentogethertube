import type { CustomMediaTextTrack } from "./models/zod-schemas.js";

export function normalizeSubtitleTrack(value: string | null | undefined): string | null {
	return value || null;
}

/**
 * Guesses the content type from the URL extension, defaulting to `text/vtt`. The default is
 * intentionally permissive: the server does not validate external subtitle URLs, so an
 * unsupported file fails to render in the browser rather than being rejected.
 */
export function inferSubtitleContentType(url: string): CustomMediaTextTrack["contentType"] {
	const path = url.split("?")[0].split("#")[0];
	const ext = path.split(".").pop()?.toLowerCase();
	return ext === "ass" || ext === "ssa" ? "text/x-ass" : "text/vtt";
}

export function externalSubtitleAsTextTrack(url: string): CustomMediaTextTrack {
	return {
		url,
		contentType: inferSubtitleContentType(url),
		srclang: "und",
		default: true,
	};
}
