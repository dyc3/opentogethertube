import type { CustomMediaTextTrack } from "./models/zod-schemas.js";

export function normalizeSubtitleTrack(value: string | null | undefined): string | null {
	return value || null;
}

function subtitleUrlExtension(url: string): string | undefined {
	const path = url.split("?")[0].split("#")[0];
	return path.split(".").pop()?.toLowerCase();
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

export function externalSubtitleAsTextTrack(url: string): CustomMediaTextTrack {
	const contentType = inferSubtitleContentTypeOrNull(url);
	if (!contentType) {
		// Callers only reach here with a server-validated url, so this is a programming error.
		throw new Error(`Cannot build a text track for unsupported subtitle url: ${url}`);
	}
	return {
		url,
		contentType,
		srclang: "und",
		default: true,
	};
}
