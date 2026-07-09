import { describe, it, expect } from "vitest";
import { OttApiRequestUpdateQueueItemSchema } from "../../models/zod-schemas.js";

describe("OttApiRequestUpdateQueueItemSchema defaultSubtitleTrack normalization", () => {
	const base = { service: "direct", id: "foo" };

	it.each([
		["omitted", base, null],
		["null", { ...base, defaultSubtitleTrack: null }, null],
		["empty string", { ...base, defaultSubtitleTrack: "" }, null],
	])("normalizes %s to null", (_label, input, expected) => {
		const parsed = OttApiRequestUpdateQueueItemSchema.parse(input);
		expect(parsed.defaultSubtitleTrack).toEqual(expected);
	});

	it("rejects a non-URL string", () => {
		expect(() =>
			OttApiRequestUpdateQueueItemSchema.parse({ ...base, defaultSubtitleTrack: "not a url" }),
		).toThrow();
	});

	it("rejects a non-string value", () => {
		expect(() =>
			OttApiRequestUpdateQueueItemSchema.parse({ ...base, defaultSubtitleTrack: 123 }),
		).toThrow();
	});
});
