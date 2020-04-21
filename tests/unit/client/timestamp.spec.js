import moment from 'moment';
import { secondsToTimestamp, calculateCurrentPosition } from '../../../src/timestamp';

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
		expect(calculateCurrentPosition(moment(), moment(), 0)).toEqual(0);
		expect(calculateCurrentPosition(moment(), moment(), 1)).toEqual(1);
		expect(calculateCurrentPosition(moment("8 Mar 2020 05:00:00 GMT"), moment("8 Mar 2020 05:00:03 GMT"), 0)).toEqual(3);
		expect(calculateCurrentPosition(moment("8 Mar 2020 05:00:00 GMT"), moment("8 Mar 2020 05:01:00 GMT"), 0)).toEqual(60);
		expect(calculateCurrentPosition(moment("8 Mar 2020 05:00:00 EST"), moment("8 Mar 2020 05:00:03 EST").utcOffset("+0200"), 0)).toEqual(3);
	});
});
