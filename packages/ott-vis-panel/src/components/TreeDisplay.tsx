import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Monolith, SystemState } from "ott-vis/types";
import { dedupeMonoliths } from "aggregate";
import { useEventBus } from "eventbus";

interface TreeDisplayProps extends TreeDisplayStyleProps {
	systemState: SystemState;
	width: number;
	height: number;
}

export interface TreeDisplayStyleProps {
	b2mLinkStyle?: "smooth" | "step";
	b2mSpacing?: number;
	baseNodeRadius?: number;
	balancerNodeRadius?: number;
	clientNodeRadius?: number;
	balancerGroupStyle?: "stacked" | "region-packed";
}

const color = d3.scaleOrdinal(d3.schemeCategory10);

interface TreeNode {
	id: string;
	region: string;
	group: string;
	children: TreeNode[];
}

// @ts-expect-error currently unused and i don't want to remove it yet
function buildFullTree(systemState: SystemState): TreeNode {
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

function buildMonolithTrees(monoliths: Monolith[]): TreeNode[] {
	return dedupeMonoliths(monoliths).map(monolith => {
		const roomNodes: TreeNode[] = monolith.rooms.map(room => {
			return {
				id: room.name,
				region: monolith.region,
				group: "room",
				children: Array.from({ length: room.clients }, (_, index) => {
					return {
						id: `${room.name}-${index}`,
						region: monolith.region,
						group: "client",
						children: [],
					};
				}),
			};
		});
		const monolithNode: TreeNode = {
			id: monolith.id,
			region: monolith.region,
			group: "monolith",
			children: roomNodes,
		};
		return monolithNode;
	});
}

function buildBalancerRegionTree(systemState: SystemState): TreeNode {
	const tree: TreeNode = {
		id: "root",
		region: "global",
		group: "root",
		children: [],
	};

	const byRegion = d3.group(systemState, d => d.region);

	for (const [region, balancers] of byRegion) {
		const regionNode: TreeNode = {
			id: region,
			region: region,
			group: "region",
			children: [],
		};
		tree.children.push(regionNode);
		for (const balancer of balancers) {
			const balancerNode: TreeNode = {
				id: balancer.id,
				region: balancer.region,
				group: "balancer",
				children: [],
			};
			regionNode.children.push(balancerNode);
		}
	}

	return tree;
}

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

function calcGoodTreeRadius(tree: d3.HierarchyNode<TreeNode>, nodeRadius: number): number {
	// absolute minimum radius should probably be 100
	// minimum radius to fit all the nodes on the second level

	// https://stackoverflow.com/a/56008236/3315164

	let children = tree.children?.length ?? 0;
	if (children <= 1) {
		return 100;
	}
	const padding = 5;
	const radius = (nodeRadius + padding) / Math.sin(Math.PI / children);
	// multiply to account for the depth of the tree
	const hasClients = tree.leaves().some(node => node.data.group === "client");
	return radius * (hasClients ? 4 : 2);
}

/**
 * A bounding box represented in absolute coordinates as [left, top, right, bottom]
 */
export type BoundingBox = [number, number, number, number];

/**
 * Computes the y positions of boxes in a vertically stacked layout
 * @param boxes The bounding boxes of the boxes to stack
 */
export function stackBoxes(boxes: BoundingBox[], nodeRadius: number): number[] {
	const boxYs: number[] = [];
	for (let i = 0; i < boxes.length; i++) {
		if (i === 0) {
			boxYs.push(0);
		} else {
			const [_pleft, _ptop, _pright, pbottom] = boxes[i - 1];
			const [_left, top, _right, _bottom] = boxes[i];
			const spacing = -top + pbottom + nodeRadius * 2 + 10;
			boxYs.push(boxYs[i - 1] + Math.max(spacing, nodeRadius * 2 + 10));
		}
	}

	return boxYs;
}

/**
 * Flips a bounding box horizontally, effectively mirroring it across the y-axis at x = 0
 * @param box
 */
export function flipBoundingBoxH(box: BoundingBox): BoundingBox {
	return [-box[2], box[1], -box[0], box[3]];
}

function mirrorTree(tree: d3.HierarchyNode<TreeNode>): d3.HierarchyNode<TreeNode> {
	const mirrored = tree;
	mirrored.each(node => {
		// @ts-expect-error d3 adds x and y to the node
		node.x = -node.x;
	});
	return mirrored;
}

interface Node {
	id: string;
	x: number;
	y: number;
}

interface BalancerNode extends Node {
	region: string;
	group: string;
}

interface MonolithNode extends Node {
	tree: d3.HierarchyNode<TreeNode>;
	boundingBox: [number, number, number, number];
}

const DEBUG_BOUNDING_BOXES = false;

const TreeDisplay: React.FC<TreeDisplayProps> = ({
	systemState,
	width,
	height,
	b2mLinkStyle = "smooth",
	b2mSpacing = 300,
	baseNodeRadius = 20,
	balancerNodeRadius = 30,
	clientNodeRadius = 8,
	balancerGroupStyle = "stacked",
}) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	// const systemTree = useMemo(() => buildFullTree(systemState), [systemState]);
	const monolithTrees = buildMonolithTrees(systemState.flatMap(b => b.monoliths));

	const [chartTransform, setChartTransform] = useState("translate(0, 0)");

	const getRadius = useCallback((group: string): number => {
		if (group === "client") {
			return clientNodeRadius;
		} else if (group === "balancer") {
			return balancerNodeRadius;
		} else {
			return baseNodeRadius;
		}
	}, [baseNodeRadius, balancerNodeRadius, clientNodeRadius]);

	useEffect(() => {
		if (svgRef.current) {
			// because d3-hierarchy doesn't support trees with multiple parents, we need to do manual layouts for balancers and monoliths, but we can use the built-in tree layout for monolith down to clients

			const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
			const wholeGraph = svg.select("g.chart");
			const gb2mLinks = wholeGraph.selectAll("g.b2m-links");

			// build all the sub-trees first
			const builtMonolithTrees: d3.HierarchyNode<TreeNode>[] = [];
			for (const monolithTree of monolithTrees) {
				const root = d3.hierarchy(monolithTree);
				const radius = calcGoodTreeRadius(root, baseNodeRadius);
				const treeLayout = d3
					.tree<TreeNode>()
					.size([Math.PI, radius])
					.separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
				treeLayout(root);
				// precompute radial coordinates
				root.each(node => {
					if (node.data.group === "client") {
						// @ts-expect-error d3 adds x and y to the node
						node.y = radius / 2 + 60;
					}
					// @ts-expect-error d3 adds x and y to the node
					const [x, y] = d3.pointRadial(node.x, node.y);
					// @ts-expect-error d3 adds x and y to the node
					node.x = x;
					// @ts-expect-error d3 adds x and y to the node
					node.y = y;
				});

				builtMonolithTrees.push(root);
			}

			// compute positions of monolith trees
			const monolithTreeBoxes = builtMonolithTrees.map(tree => treeBoundingBox(tree));
			const boxesRight = monolithTreeBoxes.slice(0, Math.floor(monolithTreeBoxes.length / 2));
			const boxesLeft = monolithTreeBoxes
				.splice(Math.floor(monolithTreeBoxes.length / 2))
				.map(flipBoundingBoxH);
			monolithTreeBoxes.push(...boxesLeft);
			const monolithTreeYsRight: number[] = stackBoxes(boxesRight, baseNodeRadius);
			const monolithTreeYsLeft: number[] = stackBoxes(boxesLeft, baseNodeRadius);
			// add an offset to the smaller column to center it
			const largestRight = monolithTreeYsRight[monolithTreeYsRight.length - 1] ?? 0;
			const largestLeft = monolithTreeYsLeft[monolithTreeYsLeft.length - 1] ?? 0;
			const offsetY = Math.abs(largestRight - largestLeft) / 2;
			if (largestRight > largestLeft) {
				monolithTreeYsLeft.forEach((y, i) => {
					monolithTreeYsLeft[i] = y + offsetY;
				});
			} else if (largestLeft > largestRight) {
				monolithTreeYsRight.forEach((y, i) => {
					monolithTreeYsRight[i] = y + offsetY;
				});
			}
			const monolithTreeYs = monolithTreeYsRight.concat(monolithTreeYsLeft);
			const monolithNodes = monolithTrees.map((monolith, i) => {
				const isRight = i < boxesRight.length;
				const node: MonolithNode = {
					tree: isRight ? builtMonolithTrees[i] : mirrorTree(builtMonolithTrees[i]),
					id: monolith.id,
					x: isRight ? b2mSpacing : -b2mSpacing,
					y: monolithTreeYs[i],
					boundingBox: monolithTreeBoxes[i],
				};
				return node;
			});

			// create nodes for all the balancers evenly spaced along the full height of the monolith trees
			// but also guaranteeing that they don't overlap with each other or the monoliths with some padding
			const fullHeight = Math.max(...monolithTreeYs);
			const lerp = d3.interpolateNumber(0, fullHeight);
			const lerpincr = 1 / (systemState.length - 1);
			const yincr = Math.max(lerp(lerpincr), balancerNodeRadius * 2 + 20);
			const balancerNodes = systemState.map((balancer, i) => {
				const node: BalancerNode = {
					id: balancer.id,
					region: balancer.region,
					group: "balancer",
					x: 0,
					y: i * yincr,
				};
				return node;
			});

			const tr = d3.transition().duration(1000).ease(d3.easeCubicInOut);

			const balancerGroup = wholeGraph.select("g.balancers");
			const balancerCircles = balancerGroup.select("g.b-circles").selectAll(".balancer");
			const balancerTexts = balancerGroup.select("g.b-texts").selectAll(".balancer-text");
			if (balancerGroupStyle === "stacked") {
				balancerGroup.transition(tr).attr("transform", `translate(0, 0)`);

				balancerCircles
					// TODO: add key function to data join when balancer ids are stable
					.data(balancerNodes)
					.join(
						create =>
							create
								.append("circle")
								.attr("cx", d => d.x)
								.attr("cy", d => d.y)
								.attr("class", "balancer")
								.attr("stroke", "white")
								.attr("stroke-width", 2),
						update => update,
						exit => exit.transition(tr).attr("r", 0).remove()
					)
					.attr("fill", d => color(d.group))
					.attr("data-nodeid", d => d.id)
					.transition(tr)
					.attr("cx", d => d.x)
					.attr("cy", d => d.y)
					.attr("r", balancerNodeRadius);
				balancerTexts
					// TODO: add key function to data join when balancer ids are stable
					.data(balancerNodes)
					.join(
						create =>
							create
								.append("text")
								.attr("x", d => d.x)
								.attr("y", d => d.y + 4)
								.attr("class", "balancer-text")
								.attr("text-anchor", "middle")
								.attr("stroke-width", 0)
								.attr("fill", "white"),
						update => update,
						exit => exit.transition(tr).attr("font-size", 0).remove()
					)
					.text(d => `${d.region.substring(0, 3)} ${d.id}`.substring(0, 10))
					.transition(tr)
					.attr("font-size", 10)
					.attr("x", d => d.x)
					.attr("y", d => d.y + 4);
			} else if (balancerGroupStyle === "region-packed") {
				const balancerTree = buildBalancerRegionTree(systemState);
				const root = d3
					.hierarchy(balancerTree)
					.sum(d => 1)
					.sort((a, b) => d3.ascending(a.data.region, b.data.region));
				const pack = d3
					.pack<TreeNode>()
					.padding(3)
					.radius(d => balancerNodeRadius);
				pack(root);

				// HACK: for some reason the pack layout is not centered at 0, 0
				balancerGroup
					.transition(tr)
					// @ts-expect-error d3 adds x and y to the node
					.attr("transform", `translate(${-root.x}, ${-root.y + fullHeight / 2})`);

				const balColor = d3
					.scaleOrdinal()
					.range([
						d3.color(color("balancer"))?.darker(2),
						d3.color(color("balancer"))?.darker(1),
					]);

				balancerCircles
					// TODO: add key function to data join when balancer ids are stable
					// .data(root.descendants(), (d: any) => d.data.id)
					.data(root.descendants())
					.join(
						create =>
							create
								.append("circle")
								.attr("cx", (d: any) => d.x)
								.attr("cy", (d: any) => d.y)
								.attr("class", "balancer")
								.attr("stroke", "white")
								.attr("stroke-width", 2),
						update => update,
						exit => exit.transition(tr).attr("r", 0).remove()
					)
					// @ts-expect-error this is valid and it works
					.attr("fill", d =>
						d.data.group === "balancer" ? color(d.data.group) : balColor(d.data.group)
					)
					.attr("data-nodeid", d => d.data.id)
					.transition(tr)
					.attr("cx", (d: any) => d.x)
					.attr("cy", (d: any) => d.y)
					.attr("r", (d: any) => d.r);

				balancerTexts
					// TODO: add key function to data join when balancer ids are stable
					.data(root.leaves())
					.join(
						create =>
							create
								.append("text")
								.attr("x", (d: any) => d.x)
								.attr("y", (d: any) => d.y + 4)
								.attr("class", "balancer-text")
								.attr("text-anchor", "middle")
								.attr("alignment-baseline", "middle")
								.attr("font-family", "Inter, Helvetica, Arial, sans-serif")
								.attr("stroke-width", 0)
								.attr("fill", "white"),
						update => update,
						exit => exit.transition(tr).attr("font-size", 0).remove()
					)
					.text(d => `${d.data.id}`.substring(0, 8))
					.transition(tr)
					.attr("font-size", 10)
					.attr("x", (d: any) => d.x)
					.attr("y", (d: any) => d.y + 4);
			}

			// create groups for all the monoliths
			const monolithGroup = wholeGraph.select("g.monoliths");
			const monolithGroups = monolithGroup
				.selectAll("g.monolith")
				.data(monolithNodes, (d: any) => d.id);
			// for debugging, draw the bounding boxes of the monolith trees
			if (DEBUG_BOUNDING_BOXES) {
				monolithGroups
					.join("rect")
					.attr("x", d => d.x + d.boundingBox[0])
					.attr("y", d => d.y + d.boundingBox[1])
					.attr("width", d => d.boundingBox[2] - d.boundingBox[0])
					.attr("height", d => d.boundingBox[3] - d.boundingBox[1])
					.attr("fill", "rgba(255, 255, 255, 0.1)")
					.attr("stroke", "white")
					.attr("stroke-width", 1);
			}
			monolithGroups
				.join(
					create =>
						create
							.append("g")
							.attr("class", "monolith")
							.attr("transform", d => `translate(${d.x}, ${d.y})`),
					update => update,
					exit => exit.remove()
				)
				.transition(tr)
				.attr("transform", d => `translate(${d.x}, ${d.y})`)
				.each(function (d) {
					const diagonal = d3
						.linkRadial<any, TreeNode>()
						.angle((d: any) => Math.atan2(d.y, d.x) + Math.PI / 2)
						.radius((d: any) => Math.sqrt(d.x * d.x + d.y * d.y));

					const monolith = d3.select(this);
					monolith
						.selectAll(".treelink")
						.data(d.tree.links(), (d: any) => d.source?.data?.id + d.target?.data?.id)
						.join(
							create => create.append("path").attr("class", "treelink"),
							update => update,
							exit => exit.transition(tr).attr("stroke-width", 0).remove()
						)
						.attr("fill", "none")
						.attr("stroke", "white")
						.attr("data-nodeid-source", d => d.source.data.id)
						.attr("data-nodeid-target", d => d.target.data.id)
						.transition(tr)
						.attr("d", diagonal)
						.attr("stroke-width", 1.5);

					monolith
						.selectAll(".monolith")
						.data(d.tree.descendants(), (d: any) => d.data?.id)
						.join(
							create =>
								create
									.append("circle")
									.attr("class", "monolith")
									.attr("stroke", "white")
									.attr("stroke-width", 2)
									.attr("cx", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("cy", (d: any) => (d.parent ? d.parent.y : d.y)),
							update => update,
							exit =>
								exit
									.transition(tr)
									.attr("r", 0)
									.attr("cx", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("cy", (d: any) => (d.parent ? d.parent.y : d.y))
									.remove()
						)
						.attr("data-nodeid", d => d.data.id)
						.attr("fill", d => color(d.data.group))
						.transition(tr)
						.attr("cx", (d: any) => d.x)
						.attr("cy", (d: any) => d.y)
						.attr("r", d => getRadius(d.data.group));

					const monolithTexts = monolith
						.selectAll(".monolith-text")
						.data(d.tree.descendants(), (d: any) => d.data?.id);
					monolithTexts
						.join(
							create =>
								create
									.append("text")
									.filter(d => d.data.group === "monolith")
									.attr("class", "monolith-text")
									.attr("text-anchor", "middle")
									.attr("stroke-width", 0)
									.attr("fill", "white")
									.attr("cx", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("cy", (d: any) => (d.parent ? d.parent.y : d.y)),
							update => update,
							exit =>
								exit
									.transition(tr)
									.attr("font-size", 0)
									.attr("cx", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("cy", (d: any) => (d.parent ? d.parent.y : d.y))
									.remove()
						)
						.text(d => `${d.data.id}`.substring(0, 6))
						.transition(tr)
						.attr("font-size", 10)
						.attr("x", (d: any) => d.x)
						.attr("y", (d: any) => d.y + 4);
				});

			// create the links between balancers and monoliths
			interface B2MLink {
				source: BalancerNode;
				target: MonolithNode;
			}
			const diagonal = d3
				.link<B2MLink, BalancerNode | MonolithNode>(
					b2mLinkStyle === "step" ? d3.curveStep : d3.curveBumpX
				)
				.x(d => d.x)
				.y(d => d.y);

			const b2mLinkData = balancerNodes.flatMap(balancer => {
				return monolithNodes.map(monolith => {
					return {
						source:
							balancerGroupStyle === "stacked"
								? balancer
								: { ...balancer, x: 0, y: fullHeight / 2 },
						target: monolith,
					};
				});
			});
			gb2mLinks
				.selectAll(".b2m-link")
				// TODO: add key function to data join when balancer ids are stable
				// .data(b2mLinkData, (d: any) => d.source?.data?.id + d.target?.data?.id);
				.data(b2mLinkData)
				.join(
					create =>
						create
							.append("path")
							.attr("class", "b2m-link")
							.attr("fill", "none")
							.attr("stroke", "white"),
					update => update,
					exit => exit.transition(tr).attr("stroke-width", 0).remove()
				)
				.attr("data-nodeid-source", d => d.source.id)
				.attr("data-nodeid-target", d => d.target.id)
				.transition(tr)
				.attr("d", diagonal)
				.attr("stroke-width", 1.5);

			const zoom = d3.zoom<SVGSVGElement, TreeNode>().on("zoom", handleZoom);
			function handleZoom(e: any) {
				svg.select("g.chart").attr("transform", e.transform);
				setChartTransform(e.transform);
			}
			svg.call(zoom);
		}
	}, [
		systemState,
		monolithTrees,
		b2mLinkStyle,
		b2mSpacing,
		baseNodeRadius,
		balancerNodeRadius,
		clientNodeRadius,
		balancerGroupStyle,
		getRadius,
	]);

	// run this only once after the first render
	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
		svg.select("g.chart").attr("transform", chartTransform);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const eventBus = useEventBus();
	useEffect(() => {
		const sub = eventBus.subscribe(event => {
			const node = d3.select(`[data-nodeid="${event.node_id}"]`);
			if (node.empty()) {
				return;
			}
			const data = node.data()[0] as d3.HierarchyNode<TreeNode>;
			const endRadius = data ? getRadius(data.data.group) : 20;
			const radiusCurrent = parseFloat(node.attr("r"));
			const newRadius = Math.max(Math.min(radiusCurrent + 5, 40), endRadius);
			node.transition("highlight")
				.duration(333)
				.ease(d3.easeCubicOut)
				.attrTween("stroke", () => d3.interpolateRgb("#0f0", "#fff"))
				.attrTween("stroke-width", () => t => d3.interpolateNumber(4, 1.5)(t).toString())
				.attrTween("r", () => t => d3.interpolateNumber(newRadius, endRadius)(t).toString());
		});

		return () => {
			sub.unsubscribe();
		};
	}, [eventBus, getRadius]);

	return (
		<svg
			ref={svgRef}
			width={width}
			height={height}
			viewBox={`${-width / 2} ${-height / 2} ${width}, ${height}`}
			style={{
				fontFamily: "Inter, Helvetica, Arial, sans-serif",
				alignmentBaseline: "middle",
			}}
		>
			<g className="chart">
				<g className="b2m-links" />
				<g className="balancers">
					<g className="b-circles" />
					<g className="b-texts" />
				</g>
				<g className="monoliths" />
			</g>
		</svg>
	);
};

export default TreeDisplay;
