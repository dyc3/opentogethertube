import type { VideoTrack } from "@/models/media-tracks";

export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
	return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
}

export function isOfficialSite(): boolean {
	return window.location.hostname.endsWith("opentogethertube.com");
}

function gcd(a: number, b: number): number {
	while (b !== 0) {
		[a, b] = [b, a % b];
	}
	return a;
}

/**
 * Calculates the aspect ratio of a given width and height.
 * @param width - The width of the video in pixels.
 * @param height - The height of the video in pixels.
 * @returns An object containing the aspect ratio as a string, the float value of the aspect ratio, and the type of aspect ratio.
 */
function getAspectRatio(
	width: number,
	height: number
): { ratio: string; float: number; type: string } {
	if (width <= 0 || height <= 0) {
		throw new Error("Width and height must be positive numbers");
	}

	const divisor = gcd(width, height);
	const ratio = `${width / divisor}:${height / divisor}`;
	const float = width / height;
	let type: string;

	if (ratio === "16:9") {
		type = "Widescreen";
	} else if (ratio === "9:16") {
		type = "Vertical";
	} else if ((width === 2560 || width === 3440) && float > 2.0 && float < 2.5) {
		// A 2560x1080 display has a ratio of ~2.37, but 3440x1440 has ~2.39
		type = "Ultrawide";
	} else if (ratio === "4:3") {
		type = "Standard Definition";
	} else if (ratio === "1:1") {
		type = "Square";
	} else if (float > 16 / 9) {
		// It seems that any ratio wider than 16:9 is considered cinematic
		// Common cinematic ratios are 2.35, 2.39, and 2.4
		// Ref: https://www.unravel.com.au/aspect-ratio-cheat-sheet
		type = "Cinematic";
	} else {
		type = "Custom";
	}
	return {
		ratio,
		float,
		type,
	};
}

/**
 * Determines the classification of a video based on its resolution.
 * @param width - The width of the video in pixels.
 * @param height - The height of the video in pixels.
 * @returns A user-friendly label describing the video's resolution
 */
export function getFriendlyResolutionLabel(videoTrack: VideoTrack): number {
	const { width, height } = videoTrack;
	const { type } = getAspectRatio(width, height);

	if (type === "Widescreen") {
		// For widescreen content, just use height
		return height;
	}

	if (type === "Vertical") {
		// For vertical content, just use width
		return width;
	}

	// Handle ultrawide resolutions
	if (type === "Ultrawide") {
		// For ultrawide, use height as the base classification
		return height;
	}

	// Use aspect ratio type to determine resolution classification
	if (type === "Cinematic") {
		// For cinematic content, classify based on width
		if (width >= 8192) {
			return 4320; // 8K equivalent
		}
		if (width >= 6144) {
			return 3456; // 6K equivalent
		}
		if (width >= 5120) {
			return 2880; // 5K equivalent
		}
		if (width >= 3840) {
			return 2160; // 4K equivalent
		}
		if (width >= 3072) {
			return 1728; // 3K equivalent
		}
		if (width >= 2560) {
			return 1440; // 2.5K equivalent
		}
		if (width >= 1920) {
			return 1080;
		}
		if (width >= 1280) {
			return 720;
		}
	}

	// For other types (Standard Definition, Square, Custom),
	// use width-based classification for high-resolution content, with special handling
	if (width >= 8192) {
		return 4320; // 8K territory
	}
	if (width >= 6144) {
		// Special handling: only 4:3 ratios at 6K map to 4320, others to 3456
		if (type === "Standard Definition") {
			return 4320; // 6K 4:3 maps to 4320
		}
		return 3456; // 6K other ratios (Academy, 3:2, 5:3) map to 3456
	}
	if (width >= 5120) {
		return 2880; // 5K territory
	}
	if (width >= 4096) {
		return 2304; // 4K territory
	}
	if (width >= 3072) {
		return 1728; // 3K territory
	}

	// Special handling for 1920 width range
	if (width >= 1920) {
		// For 4:3 and similar ratios, use 1080p equivalent
		if (height >= 1440) {
			return 1080; // 720p 4:3 and similar ratios
		}
	}

	// Use height-based classification for lower resolutions
	if (height >= 2160) {
		return 2160; // 4K
	}
	if (height >= 1440) {
		return 1440;
	}
	if (height >= 1080) {
		return 1080;
	}
	if (height >= 720) {
		return 720;
	}

	// Generic fallback
	return height;
}
