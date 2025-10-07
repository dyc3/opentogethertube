import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { calculateCurrentPosition } from "../../timestamp.js";

describe("calculateCurrentPosition", () => {
	it("should calculate the correct playback position", () => {
		const now = dayjs();
		expect(calculateCurrentPosition(now, now, 0)).toBeCloseTo(0);
		expect(calculateCurrentPosition(now, now, 1)).toBeCloseTo(1);
		expect(
			calculateCurrentPosition(
				dayjs("8 Mar 2020 05:00:00 GMT"),
				dayjs("8 Mar 2020 05:00:03 GMT"),
				0
			)
		).toBeCloseTo(3);
		expect(
			calculateCurrentPosition(
				dayjs("8 Mar 2020 05:00:00 GMT"),
				dayjs("8 Mar 2020 05:01:00 GMT"),
				0
			)
		).toBeCloseTo(60);
		expect(
			calculateCurrentPosition(
				dayjs("8 Mar 2020 05:00:00 EST"),
				dayjs("8 Mar 2020 05:00:03 EST"),
				0
			)
		).toBeCloseTo(3);

		expect(
			calculateCurrentPosition(
				dayjs("8 Mar 2020 05:00:00 EST"),
				dayjs("8 Mar 2020 05:00:03 EST"),
				0,
				2
			)
		).toBeCloseTo(6);

		expect(
			calculateCurrentPosition(
				dayjs("8 Mar 2020 05:00:00 EST"),
				dayjs("8 Mar 2020 05:00:03 EST"),
				0,
				0.5
			)
		).toBeCloseTo(1.5);
	});
});
