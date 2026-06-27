import { describe, it, expect } from "vitest";
import { inferSubtitleContentType } from "../../subtitle.js";

describe("inferSubtitleContentType", () => {
	it("recognizes .ass and .ssa as ASS", () => {
		expect(inferSubtitleContentType("https://example.com/a.ass")).toEqual("text/x-ass");
		expect(inferSubtitleContentType("https://example.com/a.ssa")).toEqual("text/x-ass");
	});

	it("ignores query strings and hash fragments when reading the extension", () => {
		expect(inferSubtitleContentType("https://example.com/a.ass?token=1")).toEqual("text/x-ass");
		expect(inferSubtitleContentType("https://example.com/a.vtt#t=10")).toEqual("text/vtt");
	});

	it("is case-insensitive", () => {
		expect(inferSubtitleContentType("https://example.com/A.ASS")).toEqual("text/x-ass");
	});

	it("falls back to WebVTT for unknown extensions", () => {
		expect(inferSubtitleContentType("https://example.com/a.srt")).toEqual("text/vtt");
		expect(inferSubtitleContentType("https://example.com/no-extension")).toEqual("text/vtt");
	});
});
