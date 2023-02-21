import dayjs from "dayjs";

/** Calculate where the playback head should be, given a start time since playback started. */
export function calculateCurrentPosition(
	start_time: dayjs.ConfigType,
	now_time: dayjs.ConfigType,
	offset: number,
	playbackSpeed: number = 1,
): number {
	let deltaRaw = dayjs(now_time).diff(start_time, "milliseconds") / 1000;
	return offset + (deltaRaw * playbackSpeed);
}
