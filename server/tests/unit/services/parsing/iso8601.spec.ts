import { parseIso8601Duration } from "../../../../services/parsing/iso8601";

describe("parse iso8601 duration", () => {
	it.each([
		["PT10S", 10],
		["PT10.0S", 10],
		["PT10.000S", 10],
		["PT5M", 5 * 60],
		["PT40M25S", 40 * 60 + 25],
		["PT1H", 1 * 60 * 60],
		["PT1H40M25S", 1 * 60 * 60 + 40 * 60 + 25],
		["P1DT3S", 86403],
		["P1D", 86400],
	])("should parse %s into %s seconds", (timecode, seconds) => {
		expect(parseIso8601Duration(timecode)).toEqual(seconds);
	});
});
