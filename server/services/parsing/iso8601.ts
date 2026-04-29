/**
 * Parse ISO 8601 duration format into seconds.
 * Examples: PT40M25S
 */
const ISO_8601_DURATION_REGEX = /P(\d+D)?(?:T(\d+H)?(\d+M)?([\d.]+S)?)?/;
const NON_NUMERIC_DURATION_CHARS_REGEX = /[^\d.]/;

export function parseIso8601Duration(duration: string): number {
	const match = ISO_8601_DURATION_REGEX.exec(duration)
		?.slice(1)
		.map(x => {
			if (x !== null && x !== undefined) {
				return x.replace(NON_NUMERIC_DURATION_CHARS_REGEX, "");
			}
		});

	if (match === undefined) {
		throw new Error(`Failed to parse duration: ${duration}`);
	}

	const days = parseInt(match[0] ?? "0", 10) || 0;
	const hours = parseInt(match[1] ?? "0", 10) || 0;
	const minutes = parseInt(match[2] ?? "0", 10) || 0;
	const seconds = parseFloat(match[3] ?? "0") || 0;

	return days * (24 * 3600) + hours * 3600 + minutes * 60 + seconds;
}
