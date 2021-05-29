import dayjs from 'dayjs';
import { secondsToTimestamp, calculateCurrentPosition, timestampToSeconds } from '../../../src/timestamp';

describe('secondsToTimestamp spec', () => {
	it('handles positive values', () => {
		let t = secondsToTimestamp(120);
		expect(t).toMatch("02:00");
	});

	it('handles negative values', () => {
		let t = secondsToTimestamp(-120);
		expect(t).toMatch("-02:00");
	});

	it('handles time spans over an hour', () => {
		let t = secondsToTimestamp(5400);
		expect(t).toMatch("01:30:00");
	});
});

describe('calculateCurrentPosition spec', () => {
	it("should calculate the correct playback position", () => {
		expect(calculateCurrentPosition(dayjs(), dayjs(), 0)).toEqual(0);
		expect(calculateCurrentPosition(dayjs(), dayjs(), 1)).toEqual(1);
		expect(calculateCurrentPosition(dayjs("8 Mar 2020 05:00:00 GMT"), dayjs("8 Mar 2020 05:00:03 GMT"), 0)).toEqual(3);
		expect(calculateCurrentPosition(dayjs("8 Mar 2020 05:00:00 GMT"), dayjs("8 Mar 2020 05:01:00 GMT"), 0)).toEqual(60);
		expect(calculateCurrentPosition(dayjs("8 Mar 2020 05:00:00 EST"), dayjs("8 Mar 2020 05:00:03 EST").utcOffset("+0200"), 0)).toEqual(3);
	});
});

describe('timestampToSeconds spec', () => {
	it("handles seconds", () => {
		expect(timestampToSeconds("00:15")).toEqual(15);
		expect(timestampToSeconds("0:15")).toEqual(15);
	});

	it("handles minutes", () => {
		expect(timestampToSeconds("2:00")).toEqual(120);
		expect(timestampToSeconds("02:00")).toEqual(120);
	});

	it("handles minutes and seconds", () => {
		expect(timestampToSeconds("2:30")).toEqual(150);
		expect(timestampToSeconds("02:30")).toEqual(150);
	});

	it("handles hours", () => {
		expect(timestampToSeconds("01:30:00")).toEqual(5400);
	});
});
