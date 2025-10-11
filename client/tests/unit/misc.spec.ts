import { describe, it, expect } from "vitest";
import { getFriendlyResolutionLabel } from "@/util/misc";

describe("getFriendlyResolutionLabel", () => {
	describe("Friendly resolution label", () => {
		it("should return the correct resolution label", () => {
			expect(getFriendlyResolutionLabel({ width: 3840, height: 2160 })).toBe(2160); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1080 })).toBe(1080); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel({ width: 1280, height: 720 })).toBe(720); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel({ width: 2560, height: 1080 })).toBe(1080); // [Ultrawide] [64:27]
			expect(getFriendlyResolutionLabel({ width: 3440, height: 1440 })).toBe(1440); // [Ultrawide] [43:18]
			expect(getFriendlyResolutionLabel({ width: 3840, height: 2080 })).toBe(2160); // [Cinematic] [24:13]
			expect(getFriendlyResolutionLabel({ width: 3840, height: 1920 })).toBe(2160); // [Cinematic] [2:1]
			expect(getFriendlyResolutionLabel({ width: 3840, height: 1608 })).toBe(2160); // [Cinematic] [160:67]
			expect(getFriendlyResolutionLabel({ width: 1920, height: 960 })).toBe(1080); // [Cinematic] [2:1]
			expect(getFriendlyResolutionLabel({ width: 1920, height: 818 })).toBe(1080); // [Cinematic] [960:409]
			expect(getFriendlyResolutionLabel({ width: 1080, height: 1920 })).toBe(1080); // [Vertical] [9:16]
			expect(getFriendlyResolutionLabel({ width: 854, height: 480 })).toBe(480); // [Custom] [427:240]
		});
	});

	describe("Ultrawide resolutions", () => {
		it("should handle ultrawide resolutions correctly", () => {
			expect(getFriendlyResolutionLabel({ width: 2560, height: 1080 })).toBe(1080); // 64:27
			expect(getFriendlyResolutionLabel({ width: 3440, height: 1440 })).toBe(1440); // 43:18
		});
	});

	describe("Vertical resolutions (9:16)", () => {
		it("should return width for vertical content", () => {
			expect(getFriendlyResolutionLabel({ width: 2160, height: 3840 })).toBe(2160); // 4K vertical
			expect(getFriendlyResolutionLabel({ width: 1080, height: 1920 })).toBe(1080); // 1080p vertical
			expect(getFriendlyResolutionLabel({ width: 720, height: 1280 })).toBe(720); // 720p vertical
		});
	});

	describe("Square resolutions (1:1)", () => {
		it("should handle square resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1920 })).toBe(1080); // 1:1
			expect(getFriendlyResolutionLabel({ width: 1080, height: 1080 })).toBe(1080); // 1:1
			expect(getFriendlyResolutionLabel({ width: 720, height: 720 })).toBe(720); // 1:1
		});
	});

	// From: https://www.unravel.com.au/_files/ugd/61cf43_691ef40ff567402b80eb03d0d1e6ed78.pdf
	describe("Widescreen resolutions (16:9)", () => {
		it("should return height for standard 16:9 resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 8192, height: 4608 })).toBe(4608); // 8K 16:9
			expect(getFriendlyResolutionLabel({ width: 6144, height: 3456 })).toBe(3456); // 6K 16:9
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2880 })).toBe(2880); // 5K 16:9
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2304 })).toBe(2304); // 4K 16:9
			expect(getFriendlyResolutionLabel({ width: 3840, height: 2160 })).toBe(2160); // 4K 16:9
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1728 })).toBe(1728); // 3K 16:9
			expect(getFriendlyResolutionLabel({ width: 1280, height: 720 })).toBe(720); // 2K 16:9
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1080 })).toBe(1080); // 720p 16:9
			expect(getFriendlyResolutionLabel({ width: 1024, height: 576 })).toBe(576); // PAL, SD 16:9
			expect(getFriendlyResolutionLabel({ width: 853, height: 480 })).toBe(480); // NTSC DV
			expect(getFriendlyResolutionLabel({ width: 864, height: 486 })).toBe(486); // NTSC D1
		});
	});

	describe("Standard Definition resolutions (4:3)", () => {
		it("should handle 4:3 aspect ratio resolutions", () => {
			// Professional 4:3 resolutions from cheat sheet
			expect(getFriendlyResolutionLabel({ width: 8192, height: 6144 })).toBe(4320); // 8K 4:3
			expect(getFriendlyResolutionLabel({ width: 6144, height: 4608 })).toBe(4320); // 6K 4:3
			expect(getFriendlyResolutionLabel({ width: 5120, height: 3840 })).toBe(2880); // 5K 4:3
			expect(getFriendlyResolutionLabel({ width: 4096, height: 3072 })).toBe(2304); // 4K 4:3
			expect(getFriendlyResolutionLabel({ width: 3072, height: 2304 })).toBe(1728); // 3K 4:3
			expect(getFriendlyResolutionLabel({ width: 1280, height: 962 })).toBe(720); // 2K 4:3
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1440 })).toBe(1080); // 720p 4:3
			// Standard Definition 4:3
			expect(getFriendlyResolutionLabel({ width: 768, height: 576 })).toBe(576); // PAL
			expect(getFriendlyResolutionLabel({ width: 640, height: 480 })).toBe(480); // NTSC DV
			expect(getFriendlyResolutionLabel({ width: 648, height: 486 })).toBe(486); // NTSC D1
		});
	});

	describe("Cinematic resolutions", () => {
		it("should handle Cinema DCP 4K resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 3996, height: 2160 })).toBe(2160); // Flat 1.85
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1716 })).toBe(2160); // Scope 2.39
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2160 })).toBe(2160); // Full Container 1.90
		});

		it("should handle Cinema DCP 2K resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 1998, height: 1080 })).toBe(1080); // Flat 1.85
			expect(getFriendlyResolutionLabel({ width: 2048, height: 858 })).toBe(1080); // Scope 2.39
			expect(getFriendlyResolutionLabel({ width: 2048, height: 1080 })).toBe(1080); // Full Container 1.90
		});

		it("should handle 8K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 8192, height: 4428 })).toBe(4320); // 1.85
			expect(getFriendlyResolutionLabel({ width: 8192, height: 4320 })).toBe(4320); // 1.90
			expect(getFriendlyResolutionLabel({ width: 8192, height: 4096 })).toBe(4320); // 2.00
			expect(getFriendlyResolutionLabel({ width: 8192, height: 3486 })).toBe(4320); // 2.35
			expect(getFriendlyResolutionLabel({ width: 8192, height: 3456 })).toBe(4320); // 2.37
			expect(getFriendlyResolutionLabel({ width: 8192, height: 3432 })).toBe(4320); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 8192, height: 3412 })).toBe(4320); // 2.40
			expect(getFriendlyResolutionLabel({ width: 8192, height: 3356 })).toBe(4320); // 2.44
		});

		it("should handle 6K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 6144, height: 3320 })).toBe(3456); // 1.85
			expect(getFriendlyResolutionLabel({ width: 6144, height: 3232 })).toBe(3456); // 1.90
			expect(getFriendlyResolutionLabel({ width: 6144, height: 3072 })).toBe(3456); // 2.00
			expect(getFriendlyResolutionLabel({ width: 6144, height: 2614 })).toBe(3456); // 2.35
			expect(getFriendlyResolutionLabel({ width: 6144, height: 2592 })).toBe(3456); // 2.37
			expect(getFriendlyResolutionLabel({ width: 6144, height: 2574 })).toBe(3456); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 6144, height: 2560 })).toBe(3456); // 2.40
			expect(getFriendlyResolutionLabel({ width: 6144, height: 2518 })).toBe(3456); // 2.44
		});

		it("should handle 5K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2766 })).toBe(2880); // 1.85
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2700 })).toBe(2880); // 1.90
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2560 })).toBe(2880); // 2.00
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2178 })).toBe(2880); // 2.35
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2160 })).toBe(2880); // 2.37
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2144 })).toBe(2880); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2132 })).toBe(2880); // 2.40
			expect(getFriendlyResolutionLabel({ width: 5120, height: 2098 })).toBe(2880); // 2.44
		});

		it("should handle 4K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2214 })).toBe(2160); // 1.85
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2160 })).toBe(2160); // 1.90
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2048 })).toBe(2160); // 2.00
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1742 })).toBe(2160); // 2.35
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1728 })).toBe(2160); // 2.37
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1716 })).toBe(2160); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1706 })).toBe(2160); // 2.40
			expect(getFriendlyResolutionLabel({ width: 4096, height: 1678 })).toBe(2160); // 2.44
		});

		it("should handle 3K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1660 })).toBe(1728); // 1.85
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1620 })).toBe(1728); // 1.90
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1536 })).toBe(1728); // 2.00
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1306 })).toBe(1728); // 2.35
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1296 })).toBe(1728); // 2.37
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1286 })).toBe(1728); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1280 })).toBe(1728); // 2.40
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1258 })).toBe(1728); // 2.44
		});

		it("should handle 2K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 1280, height: 690 })).toBe(720); // 1.85
			expect(getFriendlyResolutionLabel({ width: 1280, height: 672 })).toBe(720); // 1.90
			expect(getFriendlyResolutionLabel({ width: 1280, height: 640 })).toBe(720); // 2.00
			expect(getFriendlyResolutionLabel({ width: 1280, height: 544 })).toBe(720); // 2.35
			expect(getFriendlyResolutionLabel({ width: 1280, height: 540 })).toBe(720); // 2.37
			expect(getFriendlyResolutionLabel({ width: 1280, height: 536 })).toBe(720); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 1280, height: 532 })).toBe(720); // 2.40 Blu-Ray Scope
			expect(getFriendlyResolutionLabel({ width: 1280, height: 524 })).toBe(720); // 2.44
		});

		it("should handle 1080p cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1036 })).toBe(1080); // 1.85
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1010 })).toBe(1080); // 1.90
			expect(getFriendlyResolutionLabel({ width: 1920, height: 960 })).toBe(1080); // 2.00
			expect(getFriendlyResolutionLabel({ width: 1920, height: 816 })).toBe(1080); // 2.35
			expect(getFriendlyResolutionLabel({ width: 1920, height: 810 })).toBe(1080); // 2.37
			expect(getFriendlyResolutionLabel({ width: 1920, height: 804 })).toBe(1080); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel({ width: 1920, height: 800 })).toBe(1080); // 2.40 Blu-Ray Scope
			expect(getFriendlyResolutionLabel({ width: 1920, height: 786 })).toBe(1080); // 2.44
		});
	});

	describe("Professional formats", () => {
		it("should handle Academy ratio (1.37)", () => {
			expect(getFriendlyResolutionLabel({ width: 8192, height: 5956 })).toBe(4320); // 8K Academy
			expect(getFriendlyResolutionLabel({ width: 6144, height: 4468 })).toBe(3456); // 6K Academy
			expect(getFriendlyResolutionLabel({ width: 5120, height: 3722 })).toBe(2880); // 5K Academy
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2978 })).toBe(2304); // 4K Academy
			expect(getFriendlyResolutionLabel({ width: 3072, height: 2234 })).toBe(1728); // 3K Academy
			expect(getFriendlyResolutionLabel({ width: 1280, height: 930 })).toBe(720); // 2K Academy
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1396 })).toBe(1080); // 720p Academy
		});

		it("should handle 3:2 ratio", () => {
			expect(getFriendlyResolutionLabel({ width: 8192, height: 5460 })).toBe(4320); // 8K 3:2
			expect(getFriendlyResolutionLabel({ width: 6144, height: 4096 })).toBe(3456); // 6K 3:2
			expect(getFriendlyResolutionLabel({ width: 5120, height: 3412 })).toBe(2880); // 5K 3:2
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2730 })).toBe(2304); // 4K 3:2
			expect(getFriendlyResolutionLabel({ width: 3072, height: 2048 })).toBe(1728); // 3K 3:2
			expect(getFriendlyResolutionLabel({ width: 1280, height: 852 })).toBe(720); // 2K 3:2
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1280 })).toBe(1080); // 720p 3:2
		});

		it("should handle 5:3 ratio", () => {
			expect(getFriendlyResolutionLabel({ width: 8192, height: 4914 })).toBe(4320); // 8K 5:3
			expect(getFriendlyResolutionLabel({ width: 6144, height: 3686 })).toBe(3456); // 6K 5:3
			expect(getFriendlyResolutionLabel({ width: 5120, height: 3072 })).toBe(2880); // 5K 5:3
			expect(getFriendlyResolutionLabel({ width: 4096, height: 2456 })).toBe(2304); // 4K 5:3
			expect(getFriendlyResolutionLabel({ width: 3072, height: 1842 })).toBe(1728); // 3K 5:3
			expect(getFriendlyResolutionLabel({ width: 1280, height: 768 })).toBe(720); // 2K 5:3
			expect(getFriendlyResolutionLabel({ width: 1920, height: 1152 })).toBe(1080); // 720p 5:3
		});
	});

	describe("Edge cases and custom resolutions", () => {
		it("should handle very high resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 7680, height: 4320 })).toBe(4320); // 8K consumer
		});

		it("should handle very small resolutions", () => {
			expect(getFriendlyResolutionLabel({ width: 320, height: 240 })).toBe(240); // QVGA
			expect(getFriendlyResolutionLabel({ width: 176, height: 144 })).toBe(144); // QCIF
		});

		it("should handle PAL widescreen with pixel aspect ratio", () => {
			expect(getFriendlyResolutionLabel({ width: 720, height: 576 })).toBe(576); // PAL widescreen
			expect(getFriendlyResolutionLabel({ width: 720, height: 480 })).toBe(480); // NTSC widescreen
			expect(getFriendlyResolutionLabel({ width: 720, height: 486 })).toBe(486); // NTSC D1 widescreen
		});
	});
});
