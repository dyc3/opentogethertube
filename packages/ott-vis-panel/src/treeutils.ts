import { dedupeMonoliths } from "aggregate";
import * as d3 from "d3";
import type { Monolith, Room, SystemState } from "ott-vis/types";

export interface TreeNode {
	id: string;
	region: string;
	group: string;
	children: TreeNode[];
}

export function buildFullTree(systemState: SystemState): TreeNode {
	const tree: TreeNode = {
		id: "root",
		region: "global",
		group: "root",
		children: [],
	};
	const monoliths = systemState.flatMap(balancer => balancer.monoliths);
	const monolithNodes: Map<string, TreeNode> = new Map(
		buildMonolithTrees(monoliths).map(monolith => {
			return [monolith.id, monolith];
		})
	);

	for (const balancer of systemState) {
		const balancerNode: TreeNode = {
			id: balancer.id,
			region: balancer.region,
			group: "balancer",
			children: [],
		};
		tree.children.push(balancerNode);
		for (const monolith of balancer.monoliths) {
			balancerNode.children.push(monolithNodes.get(monolith.id) as TreeNode);
		}
	}
	return tree;
}

export function buildMonolithTrees(monoliths: Monolith[]): TreeNode[] {
	return dedupeMonoliths(monoliths).map(monolith => {
		const monolithNode: TreeNode = {
			id: monolith.id,
			region: monolith.region,
			group: "monolith",
			children: buildRoomSubtrees(monolith),
		};
		return monolithNode;
	});
}

function buildRoomSubtree(room: Room, region: string): TreeNode {
	const roomNode: TreeNode = {
		id: room.name,
		region: region,
		group: "room",
		children: room.clients.map(c => ({
			id: c.id,
			region: region,
			group: "client",
			children: [],
		})),
	};
	return roomNode;
}

function buildRoomSubtrees(monolith: Monolith): TreeNode[] {
	return monolith.rooms.map(room => buildRoomSubtree(room, monolith.region));
}

/**
 * A bounding box represented in absolute coordinates as [left, top, right, bottom]
 */
export type BoundingBox = [number, number, number, number];

/**
 * Gets the physical bounding box of the tree after it's been laid out relative to the root node. Does not account for the size of the actual nodes, just the space they take up.
 * @param tree
 * @returns [left, top, right, bottom]
 */
export function treeBoundingBox<Datum>(
	tree: d3.HierarchyNode<Datum>
): [number, number, number, number] {
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	tree.each(node => {
		// @ts-expect-error d3 adds x and y to the node
		left = Math.min(left, node.x);
		// @ts-expect-error d3 adds x and y to the node
		top = Math.min(top, node.y);
		// @ts-expect-error d3 adds x and y to the node
		right = Math.max(right, node.x);
		// @ts-expect-error d3 adds x and y to the node
		bottom = Math.max(bottom, node.y);
	});
	return [left, top, right, bottom];
}

/**
 * Gets the physical size of a tree after it's been laid out. Does not account for the size of the actual nodes, just the space they take up.
 * @returns [width, height]
 */
export function sizeOfTree<Datum>(tree: d3.HierarchyNode<Datum>): [number, number] {
	const [left, top, right, bottom] = treeBoundingBox(tree);
	return [right - left, bottom - top];
}

export function calcGoodTreeRadius(
	tree: d3.HierarchyNode<TreeNode>,
	nodeRadius: number,
	padding = 5
): number {
	// absolute minimum radius should probably be 100
	// minimum radius to fit all the nodes on the second level

	// https://stackoverflow.com/a/56008236/3315164

	let children = tree.children?.length ?? 0;
	if (children <= 1) {
		return 100;
	}
	const radius = (nodeRadius + padding) / Math.sin(Math.PI / children);
	// multiply to account for the depth of the tree
	const hasClients = tree.leaves().some(node => node.data.group === "client");
	return radius * (hasClients ? 4 : 2);
}

/**
 * Flips a bounding box horizontally, effectively mirroring it across the y-axis at x = 0
 * @param box
 */
export function flipBoundingBoxH(box: BoundingBox): BoundingBox {
	return [-box[2], box[1], -box[0], box[3]];
}

/**
 * Creates a bounding box that contains all the input bounding boxes.
 * @param boxes
 * @returns
 */
export function superBoundingBox(boxes: BoundingBox[]): BoundingBox {
	return boxes.reduce(combineBBoxes);
}

function combineBBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
	return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export function offsetBBox(box: BoundingBox, x: number, y: number): BoundingBox {
	return [box[0] + x, box[1] + y, box[2] + x, box[3] + y];
}

export function expandBBox(box: BoundingBox, padding: number): BoundingBox {
	return [box[0] - padding, box[1] - padding, box[2] + padding, box[3] + padding];
}

function traverseGroups(tree: d3.HierarchyNode<TreeNode>): string[] {
	// def not the most efficient way to do this
	return tree
		.descendants()
		.map(node => node.data.group)
		.filter((value, index, self) => self.indexOf(value) === index);
}

/**
 * Takes a really big tree and prunes it down to just the nodes that are in the specified group range. Each level of the tree must have the exact same group name for all nodes in that level.
 * @param roots
 */
export function pruneTrees(
	roots: d3.HierarchyNode<TreeNode> | d3.HierarchyNode<TreeNode>[],
	fromGroup: string,
	toGroup: string
): d3.HierarchyNode<TreeNode>[] {
	if (Array.isArray(roots)) {
		const trees: d3.HierarchyNode<TreeNode>[] = [];
		for (const tree of roots) {
			trees.push(...pruneTrees(tree, fromGroup, toGroup));
		}
		return trees;
	}

	const groups = traverseGroups(roots);
	const fromIndex = groups.indexOf(fromGroup);
	const toIndex = groups.indexOf(toGroup);

	// get all the nodes at the from level
	const fromNodes = roots.descendants().filter(node => node.depth === fromIndex);

	const resultTrees = fromNodes.map(fromNode => {
		const from = fromNode.copy(); // note that this resets the depth of `from` to 0
		from.each(node => {
			if (node.depth === toIndex - fromNode.depth) {
				node.children = undefined;
			}
		});
		return from;
	});

	return resultTrees;
}

/**
 * Takes a tree and filters out all nodes that are not in the specified groups, but keeps the structure of the tree intact. If a node has an ancestor but it's parent is excluded, the node will continue to have the same ancestor.
 * @param roots
 * @param groups The groups to keep
 */
export function filterTreeGroups(
	roots: d3.HierarchyNode<TreeNode> | d3.HierarchyNode<TreeNode>[],
	groups: string[]
): d3.HierarchyNode<TreeNode>[] {
	if (Array.isArray(roots)) {
		const trees: d3.HierarchyNode<TreeNode>[] = [];
		for (const tree of roots) {
			trees.push(...filterTreeGroups(tree, groups));
		}
		return trees;
	}

	const allgroups = traverseGroups(roots);
	groups.sort((a, b) => d3.ascending(allgroups.indexOf(a), allgroups.indexOf(b)));
	const newRootGroup = groups[0];
	if (!newRootGroup) {
		return [];
	}

	const validNodes = roots.descendants().filter(node => groups.includes(node.data.group));
	const newRoots = validNodes.filter(node => node.data.group === newRootGroup);

	function findValidParent(node: d3.HierarchyNode<TreeNode>): d3.HierarchyNode<TreeNode> | null {
		if (!node.parent) {
			return null;
		}
		if (groups.includes(node.parent.data.group)) {
			return node.parent;
		}
		return findValidParent(node.parent);
	}

	for (const node of validNodes) {
		const parent = findValidParent(node);
		node.parent = parent;
		if (parent) {
			parent.children?.push(node);
		}

		if (node.children) {
			node.children = node.children.filter(child => groups.includes(child.data.group));
		}
	}

	return newRoots;
}
