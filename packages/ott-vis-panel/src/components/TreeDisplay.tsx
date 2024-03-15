import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Monolith, SystemState } from "ott-vis/types";
import { dedupeMonoliths } from "aggregate";
import { useEventBus } from "eventbus";

interface TreeDisplayProps {
	systemState: SystemState;
	width: number;
	height: number;
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

const NODE_RADIUS = 20;

function radius(node: TreeNode) {
	if (node.group === "client") {
		return 8;
	}
	return NODE_RADIUS;
}

const DEBUG_BOUNDING_BOXES = false;

const TreeDisplay: React.FC<TreeDisplayProps> = ({ systemState, width, height }) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	// const systemTree = useMemo(() => buildFullTree(systemState), [systemState]);
	const monolithTrees = buildMonolithTrees(systemState.flatMap(b => b.monoliths));

	const [chartTransform, setChartTransform] = useState("translate(0, 0)");

	useEffect(() => {
		if (svgRef.current) {
			// because d3-hierarchy doesn't support trees with multiple parents, we need to do manual layouts for balancers and monoliths, but we can use the built-in tree layout for monolith down to clients

			const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
			const wholeGraph = svg.select("g.chart");
			const gb2mLinks = wholeGraph.selectAll("g.b2m-links");

			// build all the sub-trees first
			const builtMonolithTrees: d3.HierarchyNode<TreeNode>[] = [];
			for (const monolithTree of monolithTrees) {
				// const treeLayout = d3.tree<TreeNode>().nodeSize([NODE_RADIUS * 2, 120]);
				const treeLayout = d3.tree<TreeNode>().size([Math.PI, 160]);
				const root = d3.hierarchy(monolithTree);
				treeLayout(root);
				// precompute radial coordinates
				root.each(node => {
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
			const monolithTreeYs: number[] = [];
			for (let i = 0; i < monolithTreeBoxes.length; i++) {
				if (i === 0) {
					monolithTreeYs.push(0);
				} else {
					const [_pleft, _ptop, _pright, pbottom] = monolithTreeBoxes[i - 1];
					const [_left, top, _right, _bottom] = monolithTreeBoxes[i];
					const spacing = -top + pbottom + NODE_RADIUS * 2 + 10;
					monolithTreeYs.push(
						monolithTreeYs[i - 1] + Math.max(spacing, NODE_RADIUS * 2 + 10)
					);
				}
			}
			const monolithNodes = monolithTrees.map((monolith, i) => {
				const node: MonolithNode = {
					tree: builtMonolithTrees[i],
					id: monolith.id,
					x: 100,
					y: monolithTreeYs[i],
					boundingBox: monolithTreeBoxes[i],
				};
				return node;
			});

			// create nodes for all the balancers evenly spaced along the full height of the monolith trees
			// but also guarenteeing that they don't overlap with each other or the monoliths with some padding
			const fullHeight = monolithTreeYs[monolithTreeYs.length - 1];
			const lerp = d3.interpolateNumber(0, fullHeight);
			const lerpincr = 1 / systemState.length;
			const yincr = Math.max(lerp(lerpincr), NODE_RADIUS * 2 + 20);
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
			const balancerCircles = balancerGroup.selectAll(".balancer").data(balancerNodes);
			balancerCircles
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
				.attr("r", NODE_RADIUS + 10);
			const balancerTexts = balancerGroup.selectAll(".balancer-text").data(balancerNodes);
			balancerTexts
				.join(
					create =>
						create
							.append("text")
							.attr("x", d => d.x)
							.attr("y", d => d.y + 4)
							.attr("class", "balancer-text")
							.attr("text-anchor", "middle")
							.attr("alignment-baseline", "middle")
							.attr("font-family", "Inter, Helvetica, Arial, sans-serif")
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

			// create groups for all the monoliths
			const monolithGroup = wholeGraph.select("g.monoliths");
			const monolithGroups = monolithGroup.selectAll("g.monolith").data(monolithNodes);
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
				.join("g")
				.attr("class", "monolith")
				.attr("transform", (d, i) => `translate(${d.x}, ${d.y})`)
				.each(function (d) {
					const diagonal = d3
						.linkHorizontal<any, TreeNode>()
						.x((d: any) => d.x)
						.y((d: any) => d.y);

					const monolith = d3.select(this);
					const monolithLinks = monolith.selectAll(".treelink").data(d.tree.links());
					monolithLinks
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

					const monolithCircles = monolith
						.selectAll(".monolith")
						.data(d.tree.descendants());
					monolithCircles
						.join(
							create =>
								create
									.append("circle")
									.attr("class", "monolith")
									.attr("stroke", "white")
									.attr("stroke-width", 2)
									.attr("cx", (d: any) => d.x)
									.attr("cy", (d: any) => d.y),
							update => update,
							exit => exit.transition(tr).attr("r", 0).remove()
						)
						.attr("data-nodeid", d => d.data.id)
						.attr("fill", d => color(d.data.group))
						.transition(tr)
						.attr("cx", (d: any) => d.x)
						.attr("cy", (d: any) => d.y)
						.attr("r", d => radius(d.data));

					const monolithTexts = monolith
						.selectAll(".monolith-text")
						.data(d.tree.descendants());
					monolithTexts
						.join(
							create =>
								create
									.append("text")
									.filter(d => d.data.group === "monolith")
									.attr("class", "monolith-text")
									.attr("text-anchor", "middle")
									.attr("alignment-baseline", "middle")
									.attr("font-family", "Inter, Helvetica, Arial, sans-serif")
									.attr("stroke-width", 0)
									.attr("fill", "white"),
							update => update,
							exit => exit.transition(tr).attr("font-size", 0).remove()
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
				.linkHorizontal<B2MLink, BalancerNode | MonolithNode>()
				.x(d => d.x)
				.y(d => d.y);

			const b2mLinkData = balancerNodes.flatMap(balancer => {
				return monolithNodes.map(monolith => {
					return {
						source: balancer,
						target: monolith,
					};
				});
			});
			const balancerMonolithLinks = gb2mLinks.selectAll(".b2m-link").data(b2mLinkData);
			balancerMonolithLinks
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
				setChartTransform(e.transform);
			}
			svg.call(zoom);
		}
	}, [systemState, monolithTrees, width, height]);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
		svg.select("g.chart").attr("transform", chartTransform);
	}, [chartTransform]);

	const eventBus = useEventBus();
	useEffect(() => {
		const sub = eventBus.subscribe(event => {
			d3.select(`[data-nodeid="${event.node_id}"]`)
				.transition()
				.duration(100)
				.attrTween("stroke", () => d3.interpolateRgb("#f00", "#fff"))
				.attrTween("stroke-width", () => t => d3.interpolateNumber(4, 1.5)(t).toString());
		});

		return () => {
			sub.unsubscribe();
		};
	}, [eventBus]);

	return (
		<svg
			ref={svgRef}
			width={width}
			height={height}
			viewBox={`${-width / 2} ${-height / 2} ${width}, ${height}`}
		>
			<g className="chart">
				<g className="b2m-links" />
				<g className="balancers" />
				<g className="monoliths" />
			</g>
		</svg>
	);
};

export default TreeDisplay;
