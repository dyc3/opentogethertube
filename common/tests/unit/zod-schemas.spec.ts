import { describe, it, expect } from "vitest";
import {
	CustomMediaManifestSchema,
	OttApiRequestUpdateQueueItemSchema,
} from "../../models/zod-schemas.js";

function buildManifest(textTracks?: unknown[]) {
	return {
		title: "Test Video",
		duration: 120,
		sources: [
			{
				url: "https://example.com/video.mp4",
				contentType: "video/mp4",
				quality: 1080,
			},
		],
		textTracks,
	};
}

describe("CustomMediaManifestSchema", () => {
	it("should accept a manifest without text tracks", () => {
		const result = CustomMediaManifestSchema.safeParse(buildManifest());
		expect(result.success).toBe(true);
	});

	it("should accept a vtt text track", () => {
		const result = CustomMediaManifestSchema.safeParse(
			buildManifest([
				{
					url: "https://example.com/subs.vtt",
					contentType: "text/vtt",
					name: "English",
					srclang: "en",
					default: true,
				},
			]),
		);
		expect(result.success).toBe(true);
	});

	it("should accept an ass text track", () => {
		const result = CustomMediaManifestSchema.safeParse(
			buildManifest([
				{
					url: "https://example.com/subs.ass",
					contentType: "text/x-ass",
					name: "English",
					srclang: "en",
				},
			]),
		);
		expect(result.success).toBe(true);
	});

	it("should accept a mix of vtt and ass text tracks", () => {
		const result = CustomMediaManifestSchema.safeParse(
			buildManifest([
				{
					url: "https://example.com/subs.vtt",
					contentType: "text/vtt",
					srclang: "en",
					default: true,
				},
				{
					url: "https://example.com/subs.ass",
					contentType: "text/x-ass",
					srclang: "de",
				},
			]),
		);
		expect(result.success).toBe(true);
	});

	it("should reject unsupported text track content types", () => {
		const result = CustomMediaManifestSchema.safeParse(
			buildManifest([
				{
					url: "https://example.com/subs.srt",
					contentType: "text/srt",
					srclang: "en",
				},
			]),
		);
		expect(result.success).toBe(false);
	});
});

describe("defaultSubtitleTrack normalization", () => {
	function parse(input: Record<string, unknown>) {
		return OttApiRequestUpdateQueueItemSchema.parse({
			service: "direct",
			id: "foo",
			...input,
		});
	}

	it.each([
		["absent", {}],
		["null", { defaultSubtitleTrack: null }],
		["empty string", { defaultSubtitleTrack: "" }],
	])("normalizes %s to null", (_label, input) => {
		expect(parse(input).defaultSubtitleTrack).toBeNull();
	});

	it("passes a valid URL through unchanged", () => {
		expect(parse({ defaultSubtitleTrack: "https://example.com/subs.ass" }).defaultSubtitleTrack).toEqual(
			"https://example.com/subs.ass",
		);
	});

	it("rejects a non-URL, non-empty string", () => {
		const result = OttApiRequestUpdateQueueItemSchema.safeParse({
			service: "direct",
			id: "foo",
			defaultSubtitleTrack: "not a url",
		});
		expect(result.success).toBe(false);
	});
});
