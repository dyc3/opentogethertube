import React, { useEffect, useMemo, useRef, useState } from "react";
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
 * Gets the physical size of a tree after it's been laid out. Does not account for the size of the actual nodes, just the space they take up.
 * @returns [width, height]
 */
export function sizeOfTree<Datum>(tree: d3.HierarchyNode<Datum>): [number, number] {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	tree.each(node => {
		// @ts-expect-error d3 adds x and y to the node
		minX = Math.min(minX, node.x);
		// @ts-expect-error d3 adds x and y to the node
		minY = Math.min(minY, node.y);
		// @ts-expect-error d3 adds x and y to the node
		maxX = Math.max(maxX, node.x);
		// @ts-expect-error d3 adds x and y to the node
		maxY = Math.max(maxY, node.y);
	});
	return [maxX - minX, maxY - minY];
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
}

const NODE_RADIUS = 20;

function radius(node: TreeNode) {
	if (node.group === "client") {
		return 8;
	}
	return NODE_RADIUS;
}

const TreeDisplay: React.FC<TreeDisplayProps> = ({ systemState, width, height }) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	// const systemTree = useMemo(() => buildFullTree(systemState), [systemState]);
	const monolithTrees = useMemo(
		() => buildMonolithTrees(systemState.flatMap(b => b.monoliths)),
		[systemState]
	);

	const [chartTransform, setChartTransform] = useState("translate(0, 0)");

	useEffect(() => {
		if (svgRef.current) {
			// because d3-hierarchy doesn't support trees with multiple parents, we need to do manual layouts for balancers and monoliths, but we can use the built-in tree layout for monolith down to clients

			const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
			const wholeGraph = svg.select("g.chart").attr("transform", chartTransform);
			const gb2mLinks = wholeGraph.selectAll("g.b2m-links");

			// build all the sub-trees first
			const builtMonolithTrees: d3.HierarchyNode<TreeNode>[] = [];
			for (const monolithTree of monolithTrees) {
				const treeLayout = d3.tree<TreeNode>().nodeSize([NODE_RADIUS * 2, 120]);
				const root = d3.hierarchy(monolithTree);
				treeLayout(root);
				builtMonolithTrees.push(root);
			}

			// compute positions of monolith trees
			// note: we are actually using the width here because the trees are being rotated 90 deg
			const monolithTreeHeights = builtMonolithTrees.map(tree => sizeOfTree(tree)[0]);
			const monolithTreeYs = monolithTreeHeights.reduce(
				(acc, height, i) => {
					acc.push(acc[i] + Math.max(height, NODE_RADIUS * 2 + 10));
					return acc;
				},
				[0]
			);
			const monolithNodes = monolithTrees.map((monolith, i) => {
				const node: MonolithNode = {
					tree: builtMonolithTrees[i],
					id: monolith.id,
					x: 100,
					y: monolithTreeYs[i],
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

			const balancerGroup = wholeGraph.select("g.balancers");
			const balancerCircles = balancerGroup.selectAll(".balancer").data(balancerNodes);
			balancerCircles
				.enter()
				.append("circle")
				.attr("class", "balancer")
				.attr("r", NODE_RADIUS + 10)
				.attr("fill", d => color(d.group))
				.attr("stroke", "white")
				.attr("stroke-width", 2)
				.attr("cx", d => d.x)
				.attr("cy", d => d.y)
				.attr("data-nodeid", d => d.id);
			balancerCircles.exit().remove();
			const balancerTexts = balancerGroup.selectAll(".balancer-text").data(balancerNodes);
			balancerTexts
				.enter()
				.append("text")
				.attr("class", "balancer-text")
				.attr("text-anchor", "middle")
				.attr("alignment-baseline", "middle")
				.attr("font-family", "Inter, Helvetica, Arial, sans-serif")
				.attr("font-size", 10)
				.attr("stroke-width", 0)
				.attr("fill", "white")
				.attr("x", d => d.x)
				.attr("y", d => d.y + 4)
				.text(d => `${d.region.substring(0, 3)} ${d.id}`.substring(0, 10));
			balancerTexts.exit().remove();

			// create groups for all the monoliths
			const monolithGroup = wholeGraph.select("g.monoliths");
			const monolithGroups = monolithGroup.selectAll(".monolith").data(monolithNodes);
			monolithGroups
				.enter()
				.append("g")
				.attr("class", "monolith")
				.attr("transform", (d, i) => `translate(${d.x}, ${d.y})`)
				.each(function (d) {
					const diagonal = d3
						.linkHorizontal<any, TreeNode>()
						.x((d: any) => d.y)
						.y((d: any) => d.x);

					const monolith = d3.select(this);
					const monolithLinks = monolith.selectAll(".treelink").data(d.tree.links());
					monolithLinks
						.enter()
						.append("path")
						.attr("class", "treelink")
						.attr("d", diagonal)
						.attr("fill", "none")
						.attr("stroke", "white")
						.attr("stroke-width", 1.5)
						.attr("data-nodeid-source", d => d.source.data.id)
						.attr("data-nodeid-target", d => d.target.data.id);
					monolithLinks.exit().remove();

					const monolithCircles = monolith
						.selectAll(".monolith")
						.data(d.tree.descendants());
					monolithCircles
						.enter()
						.append("circle")
						.attr("class", "monolith")
						.attr("r", d => radius(d.data))
						.attr("fill", d => color(d.data.group))
						.attr("stroke", "white")
						.attr("stroke-width", 2)
						.attr("cx", (d: any) => d.y)
						.attr("cy", (d: any) => d.x)
						.attr("data-nodeid", d => d.data.id);
					monolithCircles.exit().remove();
					const monolithTexts = monolith
						.selectAll(".monolith-text")
						.data(d.tree.descendants());
					monolithTexts
						.enter()
						// intentionally not showing room and client names -- user generated content can contain offensive material
						.filter(d => d.data.group === "monolith")
						.append("text")
						.attr("class", "monolith-text")
						.attr("text-anchor", "middle")
						.attr("alignment-baseline", "middle")
						.attr("font-family", "Inter, Helvetica, Arial, sans-serif")
						.attr("font-size", 10)
						.attr("stroke-width", 0)
						.attr("fill", "white")
						.attr("x", (d: any) => d.y)
						.attr("y", (d: any) => d.x + 4)
						.text(d => `${d.data.id}`.substring(0, 6));
					monolithTexts.exit().remove();
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
				.enter()
				.append("path")
				.attr("class", "b2m-link")
				.attr("d", diagonal)
				.attr("fill", "none")
				.attr("stroke", "white")
				.attr("stroke-width", 1.5)
				.attr("data-nodeid-source", d => d.source.id)
				.attr("data-nodeid-target", d => d.target.id);
			balancerMonolithLinks.exit().remove();

			const zoom = d3.zoom<SVGSVGElement, TreeNode>().on("zoom", handleZoom);
			function handleZoom(e: any) {
				svg.select("g.chart").attr("transform", e.transform);
				setChartTransform(e.transform);
			}
			svg.call(zoom);
		}
	}, [systemState, monolithTrees, width, height, chartTransform]);

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
