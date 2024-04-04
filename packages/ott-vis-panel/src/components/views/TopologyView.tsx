import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SystemState } from "ott-vis/types";
import {
	buildFullTree,
	filterTreeGroups,
	pruneTrees,
	type BoundingBox,
	type TreeNode,
	treeBoundingBox,
	calcGoodTreeRadius,
} from "treeutils";
import "./topology-view.css";
import { useColorProvider } from "colors";

/**
 * The goal of this component is to show a more accurate topology view from the perspective of actual network connections.
 *
 * There will be 2 types of trees: Balancer Trees and Monolith Trees. The Balancer Trees will show the connections between Balancers and clients, while the Monolith Trees will show the connections between Monoliths and Rooms.
 *
 * These trees will be grouped by region, and the nodes will be colored by group. Balancer Trees will be on the left, and Monolith Trees will be on the right, with connections between Balancers and Monoliths, and regions being shown by boxing the trees that are in the same region.
 */

interface TopologyViewProps extends TopologyViewStyleProps {
	systemState: SystemState;
	width: number;
	height: number;
}

export interface TopologyViewStyleProps {}

interface Subtree {
	tree: d3.HierarchyNode<TreeNode>;
	bbox: BoundingBox;
	x: number;
	y: number;
}

const DEBUG_BOUNDING_BOXES = false;

export const TopologyView: React.FC<TopologyViewProps> = ({ systemState, width, height }) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const fullTree = d3.hierarchy(buildFullTree(systemState));
	const monolithTrees = pruneTrees(fullTree, "monolith", "room");
	const balancerTrees = filterTreeGroups(fullTree, ["balancer", "client"]);
	const nodeRadius = 20;
	const subtreePadding = nodeRadius * 4;
	const colors = useColorProvider();

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const monolithSubtrees: Subtree[] = [];
		const balancerSubtrees: Subtree[] = [];

		let balancerYs = 0;
		for (const tree of balancerTrees) {
			const radius = calcGoodTreeRadius(tree, nodeRadius);
			const layout = d3.tree<TreeNode>().size([-Math.PI, radius]);
			layout(tree);
			// precompute radial coordinates
			tree.each(node => {
				// @ts-expect-error d3 adds x and y to the node
				const [x, y] = d3.pointRadial(node.x, node.y);
				// @ts-expect-error d3 adds x and y to the node
				node.x = x;
				// @ts-expect-error d3 adds x and y to the node
				node.y = y;
			});
			const bbox = treeBoundingBox(tree);
			balancerSubtrees.push({
				tree,
				bbox,
				x: -100,
				y: balancerYs,
			});
			const [_left, top, _right, bottom] = bbox;
			const height = bottom - top;
			balancerYs += height + subtreePadding;
		}
		let monolithYs = 0;
		for (const tree of monolithTrees) {
			const radius = calcGoodTreeRadius(tree, nodeRadius);
			const layout = d3.tree<TreeNode>().size([Math.PI, radius]);
			layout(tree);
			// precompute radial coordinates
			tree.each(node => {
				// @ts-expect-error d3 adds x and y to the node
				const [x, y] = d3.pointRadial(node.x, node.y);
				// @ts-expect-error d3 adds x and y to the node
				node.x = x;
				// @ts-expect-error d3 adds x and y to the node
				node.y = y;
			});
			const bbox = treeBoundingBox(tree);
			monolithSubtrees.push({
				tree,
				bbox,
				x: 100,
				y: monolithYs,
			});
			const [_left, top, _right, bottom] = bbox;
			const height = bottom - top;
			monolithYs += height + subtreePadding;
		}

		const svg = d3.select(svgRef.current);

		if (DEBUG_BOUNDING_BOXES) {
			svg.select(".monolith-trees")
				.selectAll("rect")
				.data([...monolithSubtrees, ...balancerSubtrees])
				.join("rect")
				.attr("x", d => d.x + d.bbox[0])
				.attr("y", d => d.y + d.bbox[1])
				.attr("width", d => d.bbox[2] - d.bbox[0])
				.attr("height", d => d.bbox[3] - d.bbox[1])
				.attr("fill", "rgba(255, 255, 255, 0.1)")
				.attr("stroke", "white")
				.attr("stroke-width", 1);
		}

		const diagonal = d3
			.linkRadial<any, TreeNode>()
			.angle((d: any) => Math.atan2(d.y, d.x) + Math.PI / 2)
			.radius((d: any) => Math.sqrt(d.x * d.x + d.y * d.y));
		function renderTrees(trees: Subtree[], groupClass: string) {
			svg.select(groupClass)
				.selectAll(".tree")
				.data(trees)
				.join(
					create => {
						const group = create.append("g").attr("class", "tree");
						group.append("g").attr("class", "links");
						group.append("g").attr("class", "nodes");
						group.append("g").attr("class", "texts");
						return group;
					},
					update => update,
					exit => exit.remove()
				)
				.attr("transform", d => `translate(${d.x}, ${d.y})`)
				.each(function (subtree) {
					const tree = subtree.tree;
					const group = d3.select(this);
					const gLinks = group.select(".links");
					const gNodes = group.select(".nodes");
					gLinks
						.selectAll(".link")
						.data(tree.links(), (d: any) => d.source?.data?.id + d.target?.data?.id)
						.join("path")
						.attr("class", "link")
						.attr("data-nodeid-source", d => d.source.data.id)
						.attr("data-nodeid-target", d => d.target.data.id)
						.attr("d", diagonal)
						.attr("stroke-width", 1.5);

					gNodes
						.selectAll(".node")
						.data(tree.descendants(), (d: any) => d.data.id)
						.join("circle")
						.attr("class", "node")
						.attr("data-nodeid", d => d.data.id)
						.attr("cx", (d: any) => d.x)
						.attr("cy", (d: any) => d.y)
						.attr("r", nodeRadius)
						.attr("fill", d => colors.assign(d.data.group));
				});
		}

		renderTrees(balancerSubtrees, ".balancer-trees");
		renderTrees(monolithSubtrees, ".monolith-trees");
	}, [svgRef, monolithTrees, balancerTrees, subtreePadding, nodeRadius, colors]);

	return (
		<svg
			viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
			width={width}
			height={height}
			ref={svgRef}
		>
			<g className="chart">
				<g className="regions"></g>
				<g className="balancer-trees"></g>
				<g className="monolith-trees"></g>
			</g>
		</svg>
	);
};
