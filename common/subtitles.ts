export type SubtitleFormat = "vtt" | "ass";

/** Maps subtitle MIME content types to the internal format used to pick a renderer. */
export const SUBTITLE_CONTENT_TYPES: Record<string, SubtitleFormat> = {
	"text/vtt": "vtt",
	"text/x-ssa": "ass",
};

const SUBTITLE_EXTENSIONS: Record<string, SubtitleFormat> = {
	vtt: "vtt",
	ass: "ass",
	ssa: "ass",
};

/** Determines the subtitle format from a URL's file extension, or null if unsupported/unparseable. */
export function getSubtitleFormatFromUrl(url: string): SubtitleFormat | null {
	let pathname: string;
	try {
		pathname = new URL(url).pathname;
	} catch {
		return null;
	}
	const ext = pathname.split(".").pop()?.toLowerCase();
	if (!ext) {
		return null;
	}
	return SUBTITLE_EXTENSIONS[ext] ?? null;
}
