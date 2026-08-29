import { describe, it, expect } from "vitest";
import { OttApiRequestUpdateQueueItemSchema } from "../../models/zod-schemas.js";

describe("OttApiRequestUpdateQueueItemSchema subtitleUrl normalization", () => {
	const base = { service: "direct", id: "foo" };

	it.each([
		["omitted", base, null],
		["null", { ...base, subtitleUrl: null }, null],
		["empty string", { ...base, subtitleUrl: "" }, null],
	])("normalizes %s to null", (_label, input, expected) => {
		const parsed = OttApiRequestUpdateQueueItemSchema.parse(input);
		expect(parsed.subtitleUrl).toEqual(expected);
	});

	it("rejects a non-URL string", () => {
		expect(() =>
			OttApiRequestUpdateQueueItemSchema.parse({ ...base, subtitleUrl: "not a url" }),
		).toThrow();
	});

	it("rejects a non-string value", () => {
		expect(() =>
			OttApiRequestUpdateQueueItemSchema.parse({ ...base, subtitleUrl: 123 }),
		).toThrow();
	});
});
