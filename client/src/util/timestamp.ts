import dayjs from "dayjs";
import { calculateCurrentPosition as _calculateCurrentPosition } from "ott-common/timestamp";

/**
 * Formats seconds into mm:ss if less than an hour, hh:mm:ss if greater than an hour
 */
export function secondsToTimestamp(seconds: number): string {
	const posSeconds = Math.abs(seconds);
	const timeString = new Date(posSeconds * 1000).toISOString();
	const subTimeString = posSeconds >= 3600 ? timeString.substr(11, 8) : timeString.substr(14, 5);
	return seconds < 0 ? "-" + subTimeString : subTimeString;
}

export function timestampToSeconds(timestamp: string): number {
	if (!timestamp) {
		throw new Error("Invalid timestamp");
	}
	let spl = timestamp
		.split(":")
		.map(i => parseInt(i))
		.reverse();
	if (spl.length > 3 || spl.length === 0) {
		throw new Error("Invalid timestamp");
	}
	let seconds = 0;
	for (let i = 0; i < spl.length; i++) {
		seconds += spl[i] * Math.pow(60, i);
	}
	return seconds;
}

export function isInTimeRanges(ranges: TimeRanges, time: number): boolean {
	for (let i = 0; i < ranges.length; i++) {
		if (time >= ranges.start(i) && time <= ranges.end(i)) {
			return true;
		}
	}
	return false;
}
