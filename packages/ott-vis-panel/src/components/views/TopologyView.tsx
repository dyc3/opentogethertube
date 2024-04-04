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
} from "treeutils";
import "./topology-view.css";

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

export const TopologyView: React.FC<TopologyViewProps> = ({ systemState, width, height }) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const fullTree = d3.hierarchy(buildFullTree(systemState));
	const monolithTrees = pruneTrees(fullTree, "monolith", "room");
	const balancerTrees = filterTreeGroups(fullTree, ["balancer", "client"]);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const monolithSubtrees: Subtree[] = [];
		const balancerSubtrees: Subtree[] = [];

		const layout = d3.tree<TreeNode>().nodeSize([20, 20]);
		let balancerYs = 0;
		for (const balancerTree of balancerTrees) {
			layout(balancerTree);
			const bbox = treeBoundingBox(balancerTree);
			balancerSubtrees.push({
				tree: balancerTree,
				bbox,
				x: -100,
				y: balancerYs,
			});
			const [_left, top, _right, bottom] = bbox;
			const height = bottom - top;
			balancerYs += height + 20;
		}
		let monolithYs = 0;
		for (const monolithTree of monolithTrees) {
			layout(monolithTree);
			const bbox = treeBoundingBox(monolithTree);
			monolithSubtrees.push({
				tree: monolithTree,
				bbox,
				x: 100,
				y: monolithYs,
			});
			const [_left, top, _right, bottom] = bbox;
			const height = bottom - top;
			monolithYs += height + 20;
		}

		const svg = d3.select(svgRef.current);

		const diagonal = d3
			.linkVertical<any, TreeNode>()
			.x((d: any) => d.x)
			.y((d: any) => d.y);
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
						.attr("r", 4);
				});
		}

		renderTrees(balancerSubtrees, ".balancer-trees");
		renderTrees(monolithSubtrees, ".monolith-trees");
	}, [svgRef, monolithTrees, balancerTrees]);

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
