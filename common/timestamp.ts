import dayjs from "dayjs";

/** Calculate where the playback head should be, given a start time since playback started. */
export function calculateCurrentPosition(
	start_time: dayjs.ConfigType,
	now_time: dayjs.ConfigType,
	offset: number
): number {
	return offset + dayjs(now_time).diff(start_time, "milliseconds") / 1000;
}
