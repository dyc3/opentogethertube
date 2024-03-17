import * as d3 from "d3";
import { sizeOfTree, treeBoundingBox, type BoundingBox, flipBoundingBoxH } from "./TreeDisplay";

describe("TreeDisplay", () => {
	it("should find the size of any d3 tree", () => {
		interface FooTree {
			name: string;
			children: FooTree[];
		}
		const tree: FooTree = {
			name: "root",
			children: [
				{
					name: "child1",
					children: [
						{
							name: "child1.1",
							children: [],
						},
					],
				},
				{
					name: "child2",
					children: [],
				},
			],
		};
		const treeLayout = d3.tree<any>().nodeSize([10, 10]);
		const root = d3.hierarchy(tree);
		treeLayout(root);
		const [width, height] = sizeOfTree(root);
		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});

	it("should find correct bounding box", () => {
		interface FooTree {
			name: string;
			children: FooTree[];
		}
		const tree: FooTree = {
			name: "root",
			children: [
				{
					name: "child1",
					children: [
						{
							name: "child1.1",
							children: [],
						},
					],
				},
				{
					name: "child2",
					children: [],
				},
			],
		};
		const treeLayout = d3.tree<any>().nodeSize([10, 10]);
		const root = d3.hierarchy(tree);
		treeLayout(root);
		const box = treeBoundingBox(root);
		expect(box).toEqual([-5, 0, 5, 20]);
	});

	const flipBoundingBoxHTestCases: Array<[BoundingBox, BoundingBox]> = [
		[
			[0, 0, 0, 0],
			[-0, 0, -0, 0],
		],
		[
			[0, 0, 10, 10],
			[-10, 0, -0, 10],
		],
		[
			[5, 0, 10, 10],
			[-10, 0, -5, 10],
		],
	];
	it.each(flipBoundingBoxHTestCases)(
		"should flip bounding box",
		(input: BoundingBox, expected: BoundingBox) => {
			const got = flipBoundingBoxH(input);
			expect(got).toEqual(expected);
		}
	);
});
