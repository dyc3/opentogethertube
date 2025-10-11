import { describe, it, expect } from "vitest";
import { getFriendlyResolutionLabel } from "@/util/misc";

describe("getFriendlyResolutionLabel", () => {
	describe("Friendly resolution label", () => {
		it("should return the correct resolution label", () => {
			expect(getFriendlyResolutionLabel(3840, 2160)).toBe(2160); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel(1920, 1080)).toBe(1080); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel(1280, 720)).toBe(720); // [Widescreen] [16:9]
			expect(getFriendlyResolutionLabel(2560, 1080)).toBe(1080); // [Ultrawide] [64:27]
			expect(getFriendlyResolutionLabel(3440, 1440)).toBe(1440); // [Ultrawide] [43:18]
			expect(getFriendlyResolutionLabel(3840, 2080)).toBe(2160); // [Cinematic] [24:13]
			expect(getFriendlyResolutionLabel(3840, 1920)).toBe(2160); // [Cinematic] [2:1]
			expect(getFriendlyResolutionLabel(3840, 1608)).toBe(2160); // [Cinematic] [160:67]
			expect(getFriendlyResolutionLabel(1920, 960)).toBe(1080); // [Cinematic] [2:1]
			expect(getFriendlyResolutionLabel(1920, 818)).toBe(1080); // [Cinematic] [960:409]
			expect(getFriendlyResolutionLabel(1080, 1920)).toBe(1080); // [Vertical] [9:16]
			expect(getFriendlyResolutionLabel(854, 480)).toBe(480); // [Custom] [427:240]
		});
	});

	describe("Ultrawide resolutions", () => {
		it("should handle ultrawide resolutions correctly", () => {
			expect(getFriendlyResolutionLabel(2560, 1080)).toBe(1080); // 64:27
			expect(getFriendlyResolutionLabel(3440, 1440)).toBe(1440); // 43:18
		});
	});

	describe("Vertical resolutions (9:16)", () => {
		it("should return width for vertical content", () => {
			expect(getFriendlyResolutionLabel(2160, 3840)).toBe(2160); // 4K vertical
			expect(getFriendlyResolutionLabel(1080, 1920)).toBe(1080); // 1080p vertical
			expect(getFriendlyResolutionLabel(720, 1280)).toBe(720); // 720p vertical
		});
	});

	describe("Square resolutions (1:1)", () => {
		it("should handle square resolutions", () => {
			expect(getFriendlyResolutionLabel(1920, 1920)).toBe(1080); // 1:1
			expect(getFriendlyResolutionLabel(1080, 1080)).toBe(1080); // 1:1
			expect(getFriendlyResolutionLabel(720, 720)).toBe(720); // 1:1
		});
	});

	// From: https://www.unravel.com.au/_files/ugd/61cf43_691ef40ff567402b80eb03d0d1e6ed78.pdf
	describe("Widescreen resolutions (16:9)", () => {
		it("should return height for standard 16:9 resolutions", () => {
			expect(getFriendlyResolutionLabel(8192, 4608)).toBe(4608); // 8K 16:9
			expect(getFriendlyResolutionLabel(6144, 3456)).toBe(3456); // 6K 16:9
			expect(getFriendlyResolutionLabel(5120, 2880)).toBe(2880); // 5K 16:9
			expect(getFriendlyResolutionLabel(4096, 2304)).toBe(2304); // 4K 16:9
			expect(getFriendlyResolutionLabel(3840, 2160)).toBe(2160); // 4K 16:9
			expect(getFriendlyResolutionLabel(3072, 1728)).toBe(1728); // 3K 16:9
			expect(getFriendlyResolutionLabel(1280, 720)).toBe(720); // 2K 16:9
			expect(getFriendlyResolutionLabel(1920, 1080)).toBe(1080); // 720p 16:9
			expect(getFriendlyResolutionLabel(1024, 576)).toBe(576); // PAL, SD 16:9
			expect(getFriendlyResolutionLabel(853, 480)).toBe(480); // NTSC DV
			expect(getFriendlyResolutionLabel(864, 486)).toBe(486); // NTSC D1
		});
	});

	describe("Standard Definition resolutions (4:3)", () => {
		it("should handle 4:3 aspect ratio resolutions", () => {
			// Professional 4:3 resolutions from cheat sheet
			expect(getFriendlyResolutionLabel(8192, 6144)).toBe(4320); // 8K 4:3
			expect(getFriendlyResolutionLabel(6144, 4608)).toBe(4320); // 6K 4:3
			expect(getFriendlyResolutionLabel(5120, 3840)).toBe(2880); // 5K 4:3
			expect(getFriendlyResolutionLabel(4096, 3072)).toBe(2304); // 4K 4:3
			expect(getFriendlyResolutionLabel(3072, 2304)).toBe(1728); // 3K 4:3
			expect(getFriendlyResolutionLabel(1280, 962)).toBe(720); // 2K 4:3
			expect(getFriendlyResolutionLabel(1920, 1440)).toBe(1080); // 720p 4:3
			// Standard Definition 4:3
			expect(getFriendlyResolutionLabel(768, 576)).toBe(576); // PAL
			expect(getFriendlyResolutionLabel(640, 480)).toBe(480); // NTSC DV
			expect(getFriendlyResolutionLabel(648, 486)).toBe(486); // NTSC D1
		});
	});

	describe("Cinematic resolutions", () => {
		it("should handle Cinema DCP 4K resolutions", () => {
			expect(getFriendlyResolutionLabel(3996, 2160)).toBe(2160); // Flat 1.85
			expect(getFriendlyResolutionLabel(4096, 1716)).toBe(2160); // Scope 2.39
			expect(getFriendlyResolutionLabel(4096, 2160)).toBe(2160); // Full Container 1.90
		});

		it("should handle Cinema DCP 2K resolutions", () => {
			expect(getFriendlyResolutionLabel(1998, 1080)).toBe(1080); // Flat 1.85
			expect(getFriendlyResolutionLabel(2048, 858)).toBe(1080); // Scope 2.39
			expect(getFriendlyResolutionLabel(2048, 1080)).toBe(1080); // Full Container 1.90
		});

		it("should handle 8K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(8192, 4428)).toBe(4320); // 1.85
			expect(getFriendlyResolutionLabel(8192, 4320)).toBe(4320); // 1.90
			expect(getFriendlyResolutionLabel(8192, 4096)).toBe(4320); // 2.00
			expect(getFriendlyResolutionLabel(8192, 3486)).toBe(4320); // 2.35
			expect(getFriendlyResolutionLabel(8192, 3456)).toBe(4320); // 2.37
			expect(getFriendlyResolutionLabel(8192, 3432)).toBe(4320); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(8192, 3412)).toBe(4320); // 2.40
			expect(getFriendlyResolutionLabel(8192, 3356)).toBe(4320); // 2.44
		});

		it("should handle 6K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(6144, 3320)).toBe(3456); // 1.85
			expect(getFriendlyResolutionLabel(6144, 3232)).toBe(3456); // 1.90
			expect(getFriendlyResolutionLabel(6144, 3072)).toBe(3456); // 2.00
			expect(getFriendlyResolutionLabel(6144, 2614)).toBe(3456); // 2.35
			expect(getFriendlyResolutionLabel(6144, 2592)).toBe(3456); // 2.37
			expect(getFriendlyResolutionLabel(6144, 2574)).toBe(3456); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(6144, 2560)).toBe(3456); // 2.40
			expect(getFriendlyResolutionLabel(6144, 2518)).toBe(3456); // 2.44
		});

		it("should handle 5K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(5120, 2766)).toBe(2880); // 1.85
			expect(getFriendlyResolutionLabel(5120, 2700)).toBe(2880); // 1.90
			expect(getFriendlyResolutionLabel(5120, 2560)).toBe(2880); // 2.00
			expect(getFriendlyResolutionLabel(5120, 2178)).toBe(2880); // 2.35
			expect(getFriendlyResolutionLabel(5120, 2160)).toBe(2880); // 2.37
			expect(getFriendlyResolutionLabel(5120, 2144)).toBe(2880); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(5120, 2132)).toBe(2880); // 2.40
			expect(getFriendlyResolutionLabel(5120, 2098)).toBe(2880); // 2.44
		});

		it("should handle 4K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(4096, 2214)).toBe(2160); // 1.85
			expect(getFriendlyResolutionLabel(4096, 2160)).toBe(2160); // 1.90
			expect(getFriendlyResolutionLabel(4096, 2048)).toBe(2160); // 2.00
			expect(getFriendlyResolutionLabel(4096, 1742)).toBe(2160); // 2.35
			expect(getFriendlyResolutionLabel(4096, 1728)).toBe(2160); // 2.37
			expect(getFriendlyResolutionLabel(4096, 1716)).toBe(2160); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(4096, 1706)).toBe(2160); // 2.40
			expect(getFriendlyResolutionLabel(4096, 1678)).toBe(2160); // 2.44
		});

		it("should handle 3K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(3072, 1660)).toBe(1728); // 1.85
			expect(getFriendlyResolutionLabel(3072, 1620)).toBe(1728); // 1.90
			expect(getFriendlyResolutionLabel(3072, 1536)).toBe(1728); // 2.00
			expect(getFriendlyResolutionLabel(3072, 1306)).toBe(1728); // 2.35
			expect(getFriendlyResolutionLabel(3072, 1296)).toBe(1728); // 2.37
			expect(getFriendlyResolutionLabel(3072, 1286)).toBe(1728); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(3072, 1280)).toBe(1728); // 2.40
			expect(getFriendlyResolutionLabel(3072, 1258)).toBe(1728); // 2.44
		});

		it("should handle 2K cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(1280, 690)).toBe(720); // 1.85
			expect(getFriendlyResolutionLabel(1280, 672)).toBe(720); // 1.90
			expect(getFriendlyResolutionLabel(1280, 640)).toBe(720); // 2.00
			expect(getFriendlyResolutionLabel(1280, 544)).toBe(720); // 2.35
			expect(getFriendlyResolutionLabel(1280, 540)).toBe(720); // 2.37
			expect(getFriendlyResolutionLabel(1280, 536)).toBe(720); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(1280, 532)).toBe(720); // 2.40 Blu-Ray Scope
			expect(getFriendlyResolutionLabel(1280, 524)).toBe(720); // 2.44
		});

		it("should handle 1080p cinematic resolutions", () => {
			expect(getFriendlyResolutionLabel(1920, 1036)).toBe(1080); // 1.85
			expect(getFriendlyResolutionLabel(1920, 1010)).toBe(1080); // 1.90
			expect(getFriendlyResolutionLabel(1920, 960)).toBe(1080); // 2.00
			expect(getFriendlyResolutionLabel(1920, 816)).toBe(1080); // 2.35
			expect(getFriendlyResolutionLabel(1920, 810)).toBe(1080); // 2.37
			expect(getFriendlyResolutionLabel(1920, 804)).toBe(1080); // 2.39 DCI Scope
			expect(getFriendlyResolutionLabel(1920, 800)).toBe(1080); // 2.40 Blu-Ray Scope
			expect(getFriendlyResolutionLabel(1920, 786)).toBe(1080); // 2.44
		});
	});

	describe("Professional formats", () => {
		it("should handle Academy ratio (1.37)", () => {
			expect(getFriendlyResolutionLabel(8192, 5956)).toBe(4320); // 8K Academy
			expect(getFriendlyResolutionLabel(6144, 4468)).toBe(3456); // 6K Academy
			expect(getFriendlyResolutionLabel(5120, 3722)).toBe(2880); // 5K Academy
			expect(getFriendlyResolutionLabel(4096, 2978)).toBe(2304); // 4K Academy
			expect(getFriendlyResolutionLabel(3072, 2234)).toBe(1728); // 3K Academy
			expect(getFriendlyResolutionLabel(1280, 930)).toBe(720); // 2K Academy
			expect(getFriendlyResolutionLabel(1920, 1396)).toBe(1080); // 720p Academy
		});

		it("should handle 3:2 ratio", () => {
			expect(getFriendlyResolutionLabel(8192, 5460)).toBe(4320); // 8K 3:2
			expect(getFriendlyResolutionLabel(6144, 4096)).toBe(3456); // 6K 3:2
			expect(getFriendlyResolutionLabel(5120, 3412)).toBe(2880); // 5K 3:2
			expect(getFriendlyResolutionLabel(4096, 2730)).toBe(2304); // 4K 3:2
			expect(getFriendlyResolutionLabel(3072, 2048)).toBe(1728); // 3K 3:2
			expect(getFriendlyResolutionLabel(1280, 852)).toBe(720); // 2K 3:2
			expect(getFriendlyResolutionLabel(1920, 1280)).toBe(1080); // 720p 3:2
		});

		it("should handle 5:3 ratio", () => {
			expect(getFriendlyResolutionLabel(8192, 4914)).toBe(4320); // 8K 5:3
			expect(getFriendlyResolutionLabel(6144, 3686)).toBe(3456); // 6K 5:3
			expect(getFriendlyResolutionLabel(5120, 3072)).toBe(2880); // 5K 5:3
			expect(getFriendlyResolutionLabel(4096, 2456)).toBe(2304); // 4K 5:3
			expect(getFriendlyResolutionLabel(3072, 1842)).toBe(1728); // 3K 5:3
			expect(getFriendlyResolutionLabel(1280, 768)).toBe(720); // 2K 5:3
			expect(getFriendlyResolutionLabel(1920, 1152)).toBe(1080); // 720p 5:3
		});
	});

	describe("Edge cases and custom resolutions", () => {
		it("should handle very high resolutions", () => {
			expect(getFriendlyResolutionLabel(7680, 4320)).toBe(4320); // 8K consumer
		});

		it("should handle very small resolutions", () => {
			expect(getFriendlyResolutionLabel(320, 240)).toBe(240); // QVGA
			expect(getFriendlyResolutionLabel(176, 144)).toBe(144); // QCIF
		});

		it("should handle PAL widescreen with pixel aspect ratio", () => {
			expect(getFriendlyResolutionLabel(720, 576)).toBe(576); // PAL widescreen
			expect(getFriendlyResolutionLabel(720, 480)).toBe(480); // NTSC widescreen
			expect(getFriendlyResolutionLabel(720, 486)).toBe(486); // NTSC D1 widescreen
		});
	});
});
