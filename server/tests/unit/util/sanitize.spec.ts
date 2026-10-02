import { describe, it, expect } from "vitest";
import { sanitizeLogInput } from "../../../util/sanitize.js";

describe("sanitizeLogInput", () => {
	it("should return empty string for empty input", () => {
		expect(sanitizeLogInput("")).toBe("");
	});

	it("should preserve harmless text and queries", () => {
		expect(sanitizeLogInput("Chainsaw Man movie")).toBe("Chainsaw Man movie");
		expect(sanitizeLogInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
	});

	it("should mask api_key in query params", () => {
		const input = "https://my.jellyfin.com/Items/movie123/Download?api_key=sampleApiKey123";
		expect(sanitizeLogInput(input)).toBe(
			"https://my.jellyfin.com/Items/movie123/Download?api_key=[REDACTED]",
		);
	});

	it("should mask apiKey (camelCase) and token in query params", () => {
		const input =
			"https://jellyfin.example.com/web/index.html?id=123&apiKey=secretKey123&token=myToken";
		expect(sanitizeLogInput(input)).toBe(
			"https://jellyfin.example.com/web/index.html?id=123&apiKey=[REDACTED]&token=[REDACTED]",
		);
	});

	it("should mask api_key in hash fragment", () => {
		const input = "https://my.jellyfin.com/web/#/details?id=movie123&api_key=key123&foo=bar";
		expect(sanitizeLogInput(input)).toBe(
			"https://my.jellyfin.com/web/#/details?id=movie123&api_key=[REDACTED]&foo=bar",
		);
	});

	it("should mask embedded passwords in URLs", () => {
		const input = "http://admin:superSecret123@example.com/stream.m3u8";
		expect(sanitizeLogInput(input)).toBe("http://admin:REDACTED@example.com/stream.m3u8");
	});
});
