import * as d3 from "d3";
import type { Monolith } from "ott-vis/types";
import {
	type BoundingBox,
	bboxCenter,
	bboxSize,
	buildMonolithTrees,
	expandBBox,
	filterTreeGroups,
	flipBoundingBoxH,
	mergeTrees,
	offsetBBox,
	pruneTrees,
	sizeOfTree,
	superBoundingBox,
	type TreeNode,
	treeBoundingBox,
} from "treeutils";

describe("treeutils", () => {
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

	const flipBoundingBoxHTestCases: [BoundingBox, BoundingBox][] = [
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

	it("should correctly assign client ids", () => {
		const monoliths: Monolith[] = [
			{
				id: "154d9d41-128c-45ab-83d8-28661882c9e3",
				region: "ewr",
				rooms: [
					{
						name: "foo",
						clients: [
							{ id: "de6be90b-f8d3-4331-9ef4-f8fd4c995214", edge_region: "ewr" },
							{ id: "4341c5aa-ca7c-4698-838e-f398b836fadf", edge_region: "ewr" },
						],
					},
					{
						name: "baz",
						clients: [
							{ id: "5e6e740d-2cb1-41c4-a30e-094adc8b478e", edge_region: "ewr" },
							{ id: "bba0da6a-6f0b-483d-b892-b7064a09a76d", edge_region: "ewr" },
						],
					},
				],
			},
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "cdg",
				rooms: [
					{
						name: "bar",
						clients: [
							{ id: "addd57a7-e832-4ffa-a28b-575f8af24d41", edge_region: "ewr" },
							{ id: "91e7d722-3ef9-4ec7-a9df-451fe11baad1", edge_region: "ewr" },
						],
					},
					{
						name: "qux",
						clients: [
							{ id: "deb6edec-2b95-4621-80ed-1a1eb6e25b26", edge_region: "ewr" },
							{ id: "545aa543-76c6-4317-84df-bac07f46b805", edge_region: "ewr" },
						],
					},
				],
			},
		];

		const expectedTrees: TreeNode[] = [
			{
				id: "154d9d41-128c-45ab-83d8-28661882c9e3",
				region: "ewr",
				group: "monolith",
				children: [
					{
						id: "foo",
						region: "ewr",
						group: "room",
						children: [
							{
								id: "de6be90b-f8d3-4331-9ef4-f8fd4c995214",
								region: "ewr",
								group: "client",
								children: [],
							},
							{
								id: "4341c5aa-ca7c-4698-838e-f398b836fadf",
								region: "ewr",
								group: "client",
								children: [],
							},
						],
					},
					{
						id: "baz",
						region: "ewr",
						group: "room",
						children: [
							{
								id: "5e6e740d-2cb1-41c4-a30e-094adc8b478e",
								region: "ewr",
								group: "client",
								children: [],
							},
							{
								id: "bba0da6a-6f0b-483d-b892-b7064a09a76d",
								region: "ewr",
								group: "client",
								children: [],
							},
						],
					},
				],
			},
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "cdg",
				group: "monolith",
				children: [
					{
						id: "bar",
						region: "cdg",
						group: "room",
						children: [
							{
								id: "addd57a7-e832-4ffa-a28b-575f8af24d41",
								region: "cdg",
								group: "client",
								children: [],
							},
							{
								id: "91e7d722-3ef9-4ec7-a9df-451fe11baad1",
								region: "cdg",
								group: "client",
								children: [],
							},
						],
					},
					{
						id: "qux",
						region: "cdg",
						group: "room",
						children: [
							{
								id: "deb6edec-2b95-4621-80ed-1a1eb6e25b26",
								region: "cdg",
								group: "client",
								children: [],
							},
							{
								id: "545aa543-76c6-4317-84df-bac07f46b805",
								region: "cdg",
								group: "client",
								children: [],
							},
						],
					},
				],
			},
		];

		const result = buildMonolithTrees(monoliths);
		expect(result).toEqual(expectedTrees);
	});

	it("should prune tree", () => {
		const bigtree: TreeNode = {
			id: "root",
			region: "bruh",
			group: "foo",
			children: [
				{
					id: "child1",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child1.1",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child1.1.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child1.1.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
						{
							id: "child1.2",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child1.2.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child1.2.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
					],
				},
				{
					id: "child2",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child2.1",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child2.1.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child2.1.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
						{
							id: "child2.2",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child2.2.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child2.2.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
					],
				},
			],
		};

		const root = d3.hierarchy(bigtree);
		const pruned = pruneTrees(root, "bar", "baz");
		expect(pruned).toHaveLength(2);
		expect(pruned[0].data.id).toEqual("child1");
		expect(pruned[1].data.id).toEqual("child2");
		expect(pruned[0].height).toEqual(2);
		expect(pruned[1].height).toEqual(2);
		expect(pruned[0].children?.[0].data.group).toEqual("baz");
		expect(pruned[0].children?.[0].children).toBeUndefined();
	});

	it("should filter groups in the tree", () => {
		expect.hasAssertions();
		const bigtree: TreeNode = {
			id: "root",
			region: "bruh",
			group: "foo",
			children: [
				{
					id: "child1",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child1.1",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child1.1.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child1.1.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
						{
							id: "child1.2",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child1.2.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child1.2.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
					],
				},
				{
					id: "child2",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child2.1",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child2.1.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child2.1.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
						{
							id: "child2.2",
							region: "bruh",
							group: "baz",
							children: [
								{
									id: "child2.2.1",
									region: "bruh",
									group: "qux",
									children: [],
								},
								{
									id: "child2.2.2",
									region: "bruh",
									group: "qux",
									children: [],
								},
							],
						},
					],
				},
			],
		};

		const root = d3.hierarchy(bigtree);
		const trees = filterTreeGroups(root, ["bar", "qux"]);
		expect.assertions((4 + 4 * 2) * trees.length + 1);
		expect(trees).toHaveLength(2);
		for (const tree of trees) {
			expect(tree.data.group).toEqual("bar");
			expect(tree.height).toEqual(2);
			expect(tree.parent).toBeNull();
			expect(tree.children).toHaveLength(4);
			for (const child of tree.leaves()) {
				expect(child.data.group).toEqual("qux");
				expect(child.parent?.data.group).toEqual("bar");
			}
		}
	});

	it("should merge trees", () => {
		const tree1 = d3.hierarchy({
			id: "root",
			region: "bruh",
			group: "foo",
			children: [
				{
					id: "child1",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child1.1",
							region: "bruh",
							group: "baz",
							children: [],
						},
						{
							id: "child1.2",
							region: "bruh",
							group: "baz",
							children: [],
						},
					],
				},
				{
					id: "child2",
					region: "bruh",
					group: "bar",
					children: [],
				},
			],
		} as TreeNode);
		const tree2 = d3.hierarchy({
			id: "root",
			region: "bruh",
			group: "foo",
			children: [
				{
					id: "child1",
					region: "bruh",
					group: "bar",
					children: [
						{
							id: "child1.1",
							region: "bruh",
							group: "baz",
							children: [],
						},
						{
							id: "child1.3",
							region: "bruh",
							group: "baz",
							children: [],
						},
					],
				},
				{
					id: "child3",
					region: "bruh",
					group: "bar",
					children: [],
				},
				{
					id: "child4",
					region: "bruh",
					group: "bar",
					children: [],
				},
			],
		} as TreeNode);

		const merged = mergeTrees([tree1, tree2])[0];
		expect(merged.data.id).toEqual("root");
		expect(merged.descendants().filter(n => n.data.group === "bar")).toHaveLength(4);
		expect(merged.descendants().filter(n => n.data.group === "baz")).toHaveLength(3);
	});

	it("should calculate the super bounding box", () => {
		const boxes: BoundingBox[] = [
			[0, 0, 10, 10],
			[-5, -5, 5, 5],
			[5, 5, 15, 15],
		];
		const result = superBoundingBox(boxes);
		expect(result).toEqual([-5, -5, 15, 15]);
	});

	it("should offset the bounding box", () => {
		const box: BoundingBox = [0, 0, 10, 10];
		const x = 5;
		const y = -3;
		const offsetBox = offsetBBox(box, x, y);
		expect(offsetBox).toEqual([5, -3, 15, 7]);
	});

	it("should expand the bounding box with padding", () => {
		const box: BoundingBox = [0, 0, 10, 10];
		const padding = 5;
		const expandedBox = expandBBox(box, padding);
		expect(expandedBox).toEqual([-5, -5, 15, 15]);
	});

	it("should handle negative padding", () => {
		const box: BoundingBox = [0, 0, 10, 10];
		const padding = -2;
		const expandedBox = expandBBox(box, padding);
		expect(expandedBox).toEqual([2, 2, 8, 8]);
	});

	it("should handle zero padding", () => {
		const box: BoundingBox = [0, 0, 10, 10];
		const padding = 0;
		const expandedBox = expandBBox(box, padding);
		expect(expandedBox).toEqual([0, 0, 10, 10]);
	});

	it("should calculate the center of the bounding box", () => {
		const box: BoundingBox = [0, 0, 10, 10];
		const center = bboxCenter(box);
		expect(center).toEqual([5, 5]);
	});

	it("should handle negative coordinates", () => {
		const box: BoundingBox = [-10, -10, 10, 10];
		const center = bboxCenter(box);
		expect(center).toEqual([0, 0]);
	});

	it("should handle non-square bounding boxes", () => {
		const box: BoundingBox = [0, 0, 20, 10];
		const center = bboxCenter(box);
		expect(center).toEqual([10, 5]);
	});

	it("should calculate the size of a bounding box", () => {
		const box: BoundingBox = [0, 0, 10, 20];
		const [width, height] = bboxSize(box);
		expect(width).toEqual(10);
		expect(height).toEqual(20);
	});

	it("should handle negative coordinates in the bounding box", () => {
		const box: BoundingBox = [-10, -10, 10, 10];
		const [width, height] = bboxSize(box);
		expect(width).toEqual(20);
		expect(height).toEqual(20);
	});

	it("should handle zero-sized bounding box", () => {
		const box: BoundingBox = [0, 0, 0, 0];
		const [width, height] = bboxSize(box);
		expect(width).toEqual(0);
		expect(height).toEqual(0);
	});
});
