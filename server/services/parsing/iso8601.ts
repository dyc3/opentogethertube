/**
 * Parse ISO 8601 duration format into seconds.
 * Examples: PT40M25S
 */
export function parseIso8601Duration(duration: string): number {
	let match = /P(\d+D)?(?:T(\d+H)?(\d+M)?([\d.]+S)?)?/
		.exec(duration)
		?.slice(1)
		.map(x => {
			if (x !== null && x !== undefined) {
				return x.replace(/[^\d.]/, "");
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
