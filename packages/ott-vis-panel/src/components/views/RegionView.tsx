import { useD3Zoom } from "chartutils";
import * as d3 from "d3";
import type { SystemState } from "ott-vis";
import React, { useEffect, useRef } from "react";
import { buildFullTree, filterTreeGroups, mergeTrees, type TreeNode } from "treeutils";

interface Props {
	systemState: SystemState;
	assignColor: (thing: string) => string;
	width: number;
	height: number;
}

export const RegionView: React.FC<Props> = ({ systemState, assignColor, width, height }) => {
	const builtTree = d3.hierarchy(buildFullTree(systemState));
	const balancerTree = filterTreeGroups(builtTree.copy(), [
		"root",
		"region",
		"balancer",
		"client",
	])[0];
	const monolithTree = filterTreeGroups(builtTree.copy(), [
		"root",
		"region",
		"monolith",
		"room",
	])[0].each(n => {
		// filter children that are not in the branch's region
		if (!n.children) {
			return;
		}
		if (n.data.group === "region") {
			n.children = n.children.filter(c => c.data.region === n.data.region);
		}
	});
	const fullTree = mergeTrees([balancerTree, monolithTree])[0];
	const svgRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const tr = d3.transition().duration(1000).ease(d3.easeCubicInOut);
		const svg = d3.select(svgRef.current);
		const group = svg.select(".chart");

		const tree = fullTree;
		const pack = d3
			.pack<TreeNode>()
			.radius(() => 20)
			.padding(20);
		pack(tree);

		group
			.select(".nodes")
			.selectAll("circle")
			.data(tree.descendants().filter(d => d.data.group !== "root"))
			.join("circle")
			.attr("class", "node")
			.transition(tr)
			.attr("cx", (d: any) => d.x)
			.attr("cy", (d: any) => d.y)
			.attr("r", (d: any) => d.r)
			.attr("fill", (d: any) => assignColor(d.data.group))
			.attr("stroke", "#fff")
			.attr("stroke-width", 1.5);

		group
			.select(".texts")
			.selectAll("text")
			.data(
				tree.descendants().filter(d => d.data.group !== "root" && d.data.group !== "room")
			)
			.join("text")
			.attr("class", "text")
			.transition(tr)
			.attr("x", (d: any) => d.x)
			.attr("y", (d: any) => d.y - d.r + 6)
			.text(d => d.data.id.substring(0, 8));
	});

	useD3Zoom(svgRef);

	return (
		<svg
			viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
			width={width}
			height={height}
			ref={svgRef}
		>
			<g className="chart">
				<g className="nodes" />
				<g className="texts" />
			</g>
		</svg>
	);
};

export default RegionView;
