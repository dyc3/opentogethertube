import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { SystemState } from "ott-vis/types";

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

function buildTree(systemState: SystemState): TreeNode {
	const tree: TreeNode = {
		id: "root",
		region: "global",
		group: "root",
		children: [],
	};
	for (const balancer of systemState) {
		const balancerNode: TreeNode = {
			id: balancer.id,
			region: balancer.region,
			group: "balancer",
			children: [],
		};
		tree.children.push(balancerNode);
		for (const monolith of balancer.monoliths) {
			const monolithNode: TreeNode = {
				id: monolith.id,
				region: monolith.region,
				group: "monolith",
				children: [],
			};
			balancerNode.children.push(monolithNode);
			for (const room of monolith.rooms) {
				const roomNode: TreeNode = {
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
				monolithNode.children.push(roomNode);
			}
		}
	}
	return tree;
}

const TreeDisplay: React.FC<TreeDisplayProps> = ({ systemState, width, height }) => {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const systemTree = useMemo(() => buildTree(systemState), [systemState]);

	useEffect(() => {
		if (systemTree && svgRef.current) {
			const treeLayout = d3.tree().size([width, height]).nodeSize([60, 120]);

			const root = d3.hierarchy(systemTree);

			// @ts-expect-error asdf
			treeLayout(root);

			// Create a new D3 diagonal generator
			const diagonal = d3
				.linkHorizontal<any, TreeNode>()
				.x((d: any) => d.y)
				.y((d: any) => d.x);

			// Select the SVG element and bind the hierarchy data to it
			const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
			const g = svg.select("g.chart");
			const nodes = g.selectAll(".node").data(root.descendants());
			const links = g.selectAll(".link").data(root.links());

			links
				.enter()
				.append("path")
				.attr("class", "link")
				.attr("d", diagonal)
				.attr("fill", "none")
				.attr("stroke", "white")
				.attr("stroke-width", 1.5);

			nodes
				.enter()
				.append("circle")
				.attr("class", "node")
				.attr("cy", (d: any) => d.x)
				.attr("cx", (d: any) => d.y)
				.attr("r", 20)
				.attr("stroke", "white")
				.attr("stroke-width", 2)
				.attr("fill", d => color(d.data.group))
				.attr("data-nodeid", d => d.data.id);

			// Update existing nodes and links
			nodes.attr("cx", (d: any) => d.y).attr("cy", (d: any) => d.x);
			links.attr("d", diagonal);

			// Remove any nodes or links that are no longer needed
			nodes.exit().remove();
			links.exit().remove();

			let zoom = d3.zoom<SVGSVGElement, TreeNode>().on("zoom", handleZoom);
			function handleZoom(e: any) {
				d3.select("g.chart").attr("transform", e.transform);
			}
			svg.call(zoom);
		}
	}, [systemTree, width, height]);

	return (
		<svg ref={svgRef} width={width} height={height}>
			<g className="chart" />
		</svg>
	);
};

export default TreeDisplay;
