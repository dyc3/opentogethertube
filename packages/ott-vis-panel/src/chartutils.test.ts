import type { BoundingBox } from "treeutils";
import { calcZoomTransform } from "../src/chartutils";

describe("calcZoomTransform", () => {
	it("should calculate the zoom transform correctly", () => {
		const bbox: BoundingBox = [0, 0, 100, 100];
		const width = 500;
		const height = 500;

		const result = calcZoomTransform(bbox, width, height);

		expect(result).toMatchObject({
			x: 0,
			y: 0,
			k: 5,
		});
	});

	it("should handle a larger width than height", () => {
		const bbox: BoundingBox = [0, 0, 100, 100];
		const width = 1000;
		const height = 500;

		const result = calcZoomTransform(bbox, width, height);

		expect(result).toMatchObject({
			x: 250,
			y: 0,
			k: 5,
		});
	});

	it("should handle a larger height than width", () => {
		const bbox: BoundingBox = [0, 0, 100, 100];
		const width = 500;
		const height = 1000;

		const result = calcZoomTransform(bbox, width, height);

		expect(result).toMatchObject({
			x: 0,
			y: 250,
			k: 5,
		});
	});
});
