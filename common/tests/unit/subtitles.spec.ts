import { describe, it, expect } from "vitest";
import { getSubtitleFormatFromUrl, SUBTITLE_CONTENT_TYPES } from "../../subtitles.js";

describe("getSubtitleFormatFromUrl", () => {
	it("recognizes .vtt", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.vtt")).toEqual("vtt");
	});

	it("recognizes .ass", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.ass")).toEqual("ass");
	});

	it("recognizes .ssa", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.ssa")).toEqual("ass");
	});

	it("is case-insensitive", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.ASS")).toEqual("ass");
	});

	it("ignores query strings", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.vtt?token=abc")).toEqual("vtt");
	});

	it("returns null for unsupported extensions", () => {
		expect(getSubtitleFormatFromUrl("https://example.com/subs.srt")).toBeNull();
	});

	it("returns null for invalid URLs", () => {
		expect(getSubtitleFormatFromUrl("not a url")).toBeNull();
	});
});

describe("SUBTITLE_CONTENT_TYPES", () => {
	it("maps text/vtt to vtt", () => {
		expect(SUBTITLE_CONTENT_TYPES["text/vtt"]).toEqual("vtt");
	});

	it("maps text/x-ssa to ass", () => {
		expect(SUBTITLE_CONTENT_TYPES["text/x-ssa"]).toEqual("ass");
	});
});
