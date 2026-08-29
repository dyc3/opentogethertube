import { describe, it, expect } from "vitest";
import {
	externalSubtitleAsTextTrackOrNull,
	inferSubtitleContentTypeOrNull,
} from "../../subtitle.js";

describe("inferSubtitleContentTypeOrNull", () => {
	it("recognizes .ass and .ssa as ASS", () => {
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.ass")).toEqual("text/x-ass");
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.ssa")).toEqual("text/x-ass");
	});

	it("recognizes .vtt as WebVTT", () => {
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.vtt")).toEqual("text/vtt");
	});

	it("ignores query strings and hash fragments when reading the extension", () => {
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.ass?token=1")).toEqual(
			"text/x-ass",
		);
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.vtt#t=10")).toEqual("text/vtt");
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.srt?x=.vtt")).toBeNull();
	});

	it("is case-insensitive", () => {
		expect(inferSubtitleContentTypeOrNull("https://example.com/A.ASS")).toEqual("text/x-ass");
	});

	it("returns null for unsupported and unrelated formats", () => {
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.srt")).toBeNull();
		expect(inferSubtitleContentTypeOrNull("https://example.com/a.mp3")).toBeNull();
		expect(inferSubtitleContentTypeOrNull("https://example.com/no-extension")).toBeNull();
	});
});

describe("externalSubtitleAsTextTrackOrNull", () => {
	it("builds a default track for supported urls", () => {
		expect(externalSubtitleAsTextTrackOrNull("https://example.com/a.vtt")).toEqual({
			url: "https://example.com/a.vtt",
			contentType: "text/vtt",
			srclang: "und",
			default: true,
		});
	});

	it("returns null instead of throwing for unsupported urls", () => {
		expect(externalSubtitleAsTextTrackOrNull("https://example.com/a.srt")).toBeNull();
	});
});
