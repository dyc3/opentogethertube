import React, { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SystemState } from "ott-vis/types";
import { useEventBus } from "eventbus";
import "./tree-display.css";
import {
	calcGoodTreeRadius,
	treeBoundingBox,
	flipBoundingBoxH,
	type TreeNode,
	buildMonolithTrees,
	stackBoxes,
} from "treeutils";
import { useD3Zoom } from "chartutils";
import { dedupeMonoliths } from "aggregate";
import type { NodeRadiusOptions } from "types";
import { useColorProvider } from "colors";

interface TreeDisplayProps extends TreeDisplayStyleProps {
	systemState: SystemState;
	width: number;
	height: number;
}

export interface TreeDisplayStyleProps extends NodeRadiusOptions {
	horizontal?: boolean;
	b2mLinkStyle?: "smooth" | "step";
	b2mSpacing?: number;
	balancerGroupStyle?: "stacked" | "region-packed";
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

function mirrorTree(tree: d3.HierarchyNode<TreeNode>): d3.HierarchyNode<TreeNode> {
	const mirrored = tree;
	mirrored.each(node => {
		// @ts-expect-error d3 adds x and y to the node
		node.x = -node.x;
	});
	return mirrored;
}

function constructMonolithSubtreesBasic(monolithTree: TreeNode, baseNodeRadius: number) {
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
	return root;
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
	horizontal = false,
	b2mLinkStyle = "smooth",
	b2mSpacing = 300,
	baseNodeRadius = 20,
	balancerNodeRadius = 30,
	clientNodeRadius = 8,
	balancerGroupStyle = "stacked",
}) => {
	const colors = useColorProvider();
	const svgRef = useRef<SVGSVGElement | null>(null);
	const monolithTrees = buildMonolithTrees(
		dedupeMonoliths(systemState.flatMap(b => b.monoliths))
	).sort((a, b) => d3.ascending(a.region, b.region) || d3.ascending(a.id, b.id));

	const getRadius = useCallback(
		(group: string): number => {
			if (group === "client") {
				return clientNodeRadius;
			} else if (group === "balancer") {
				return balancerNodeRadius;
			} else {
				return baseNodeRadius;
			}
		},
		[baseNodeRadius, balancerNodeRadius, clientNodeRadius]
	);

	useEffect(() => {
		if (svgRef.current) {
			// because d3-hierarchy doesn't support trees with multiple parents, we need to do manual layouts for balancers and monoliths, but we can use the built-in tree layout for monolith down to clients

			const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
			const wholeGraph = svg.select("g.chart");
			const gb2mLinks = wholeGraph.selectAll("g.b2m-links");

			// build all the sub-trees first
			const builtMonolithTrees: d3.HierarchyNode<TreeNode>[] = [];
			for (const monolithTree of monolithTrees) {
				const root = constructMonolithSubtreesBasic(monolithTree, baseNodeRadius);
				root.sort((a, b) => d3.ascending(a.data.id, b.data.id));
				builtMonolithTrees.push(root);
			}

			// compute positions of monolith trees
			const monolithTreeBoxes = builtMonolithTrees.map(tree => treeBoundingBox(tree));
			const boxesRight = monolithTreeBoxes.slice(0, Math.floor(monolithTreeBoxes.length / 2));
			const boxesLeft = monolithTreeBoxes
				.splice(Math.floor(monolithTreeBoxes.length / 2))
				.map(flipBoundingBoxH);
			monolithTreeBoxes.push(...boxesLeft);
			const monolithTreeYsRight: number[] = stackBoxes(boxesRight, baseNodeRadius * 2 + 10);
			const monolithTreeYsLeft: number[] = stackBoxes(boxesLeft, baseNodeRadius * 2 + 10);
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
			const balancerNodes = systemState
				.map((balancer, i) => {
					const node: BalancerNode = {
						id: balancer.id,
						region: balancer.region,
						group: "balancer",
						x: 0,
						y: i * yincr,
					};
					return node;
				})
				.sort((a, b) => d3.ascending(a.region, b.region) || d3.ascending(a.id, b.id));

			const tr = d3.transition().duration(1000).ease(d3.easeCubicInOut);

			const balancerGroup = wholeGraph.select("g.balancers");
			const balancerCircles = balancerGroup.select("g.b-circles").selectAll(".balancer");
			const balancerTexts = balancerGroup.select("g.b-texts").selectAll(".balancer-text");
			if (balancerGroupStyle === "stacked") {
				balancerGroup.transition(tr).attr("transform", `translate(0, 0)`);

				balancerCircles
					.data(balancerNodes, (d: any) => d.id)
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
					.attr("fill", d => colors.assign(d.group))
					.attr("data-nodeid", d => d.id)
					.transition(tr)
					.attr("cx", d => d.x)
					.attr("cy", d => d.y)
					.attr("r", balancerNodeRadius);
				balancerTexts
					.data(balancerNodes, (d: any) => d.id)
					.join(
						create =>
							create
								.append("text")
								.attr("x", d => d.x)
								.attr("y", d => d.y)
								.attr("class", "balancer-text"),
						update => update,
						exit => exit.transition(tr).attr("font-size", 0).remove()
					)
					.text(d => `${d.region.substring(0, 3)} ${d.id}`.substring(0, 10))
					.transition(tr)
					.attr("font-size", 10)
					.attr("x", d => d.x)
					.attr("y", d => d.y);
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
						d3.color(colors.assign("balancer"))?.darker(2),
						d3.color(colors.assign("balancer"))?.darker(1),
					]);

				balancerCircles
					.data(root.descendants(), (d: any) => d.data.id)
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
						d.data.group === "balancer"
							? colors.assign(d.data.group)
							: balColor(d.data.group)
					)
					.attr("data-nodeid", d => d.data.id)
					.transition(tr)
					.attr("cx", (d: any) => d.x)
					.attr("cy", (d: any) => d.y)
					.attr("r", (d: any) => d.r);

				balancerTexts
					.data(root.leaves(), (d: any) => d.data.id)
					.join(
						create =>
							create
								.append("text")
								.attr("x", (d: any) => d.x)
								.attr("y", (d: any) => d.y)
								.attr("class", "balancer-text"),
						update => update,
						exit => exit.transition(tr).attr("font-size", 0).remove()
					)
					.text(d => `${d.data.id}`.substring(0, 8))
					.transition(tr)
					.attr("font-size", 10)
					.attr("x", (d: any) => d.x)
					.attr("y", (d: any) => d.y);
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
					create => {
						const group = create
							.append("g")
							.attr("class", "monolith")
							.attr("transform", d => `translate(${d.x}, ${d.y})`);
						group.append("g").attr("class", "links");
						group.append("g").attr("class", "circles");
						group.append("g").attr("class", "texts g-text");
						return group;
					},
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
						.select(".links")
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
						.select(".circles")
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
						.attr("fill", d => colors.assign(d.data.group))
						.transition(tr)
						.attr("cx", (d: any) => d.x)
						.attr("cy", (d: any) => d.y)
						.attr("r", d => getRadius(d.data.group));

					const monolithTexts = monolith
						.select(".texts")
						.selectAll(".monolith-text")
						.data(d.tree.descendants(), (d: any) => d.data?.id);
					monolithTexts
						.join(
							create =>
								create
									.filter(d => d.data.group === "monolith")
									.append("text")
									.attr("class", "monolith-text")
									.attr("x", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("y", (d: any) => (d.parent ? d.parent.y : d.y)),
							update => update,
							exit =>
								exit
									.transition(tr)
									.attr("font-size", 0)
									.attr("x", (d: any) => (d.parent ? d.parent.x : d.x))
									.attr("y", (d: any) => (d.parent ? d.parent.y : d.y))
									.remove()
						)
						.text(d => `${d.data.id}`.substring(0, 6))
						.transition(tr)
						.attr("font-size", 10)
						.attr("x", (d: any) => d.x)
						.attr("y", (d: any) => d.y);
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
				.data(b2mLinkData, (d: any) => d.source?.data?.id + d.target?.data?.id)
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
		horizontal,
		colors,
	]);

	useD3Zoom(svgRef);

	const eventBus = useEventBus();
	useEffect(() => {
		const sub = eventBus.subscribe(event => {
			if (event.direction !== "rx") {
				return;
			}
			const node = d3.select(`[data-nodeid="${event.node_id}"]`);
			if (node.empty()) {
				return;
			}
			const data = node.data()[0] as d3.HierarchyNode<TreeNode>;
			const endRadius = data ? getRadius(data.data.group) : 20;
			let radiusCurrent = parseFloat(node.attr("r"));
			if (isNaN(radiusCurrent)) {
				radiusCurrent = 0;
			}
			const newRadius = Math.max(Math.min(radiusCurrent + 5, 40), endRadius);
			node.transition("highlight")
				.duration(333)
				.ease(d3.easeCubicOut)
				.attrTween("stroke", () => d3.interpolateRgb("#0f0", "#fff"))
				.attrTween("stroke-width", () => t => d3.interpolateNumber(4, 1.5)(t).toString())
				.attrTween(
					"r",
					() => t => d3.interpolateNumber(newRadius, endRadius)(t).toString()
				);
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
			viewBox={`${-width / 2} ${-height / 4} ${width} ${height}`}
		>
			<g className="chart">
				<g className={`${horizontal ? "ott-horizontal" : ""}`}>
					<g className="b2m-links" />
					<g className="balancers">
						<g className="b-circles" />
						<g className="b-texts g-text" />
					</g>
					<g className="monoliths" />
				</g>
			</g>
		</svg>
	);
};

export default TreeDisplay;
