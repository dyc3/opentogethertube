import type { CustomMediaTextTrack } from "./models/zod-schemas.js";

export function normalizeSubtitleTrack(value: string | null | undefined): string | null {
	return value || null;
}

function subtitleUrlExtension(url: string): string | undefined {
	// TODO: replace with `URL.parse(url)?.pathname` once typescript is upgraded to >= 5.7,
	// which is when `URL.parse` was added to the dom lib types.
	if (!URL.canParse(url)) {
		return undefined;
	}
	return new URL(url).pathname.split(".").pop()?.toLowerCase();
}

export function inferSubtitleContentTypeOrNull(
	url: string,
): CustomMediaTextTrack["contentType"] | null {
	const ext = subtitleUrlExtension(url);
	if (ext === "ass" || ext === "ssa") {
		return "text/x-ass";
	}
	if (ext === "vtt") {
		return "text/vtt";
	}
	return null;
}

export function externalSubtitleAsTextTrackOrNull(url: string): CustomMediaTextTrack | null {
	const contentType = inferSubtitleContentTypeOrNull(url);
	if (!contentType) {
		return null;
	}
	return {
		url,
		contentType,
		srclang: "und",
		default: true,
	};
}
