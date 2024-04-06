import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SystemState } from "ott-vis";
import { buildFullTree, type TreeNode } from "treeutils";
import { useColorProvider } from "colors";
import { useD3Zoom } from "chartutils";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

export const RegionView: React.FC<Props> = ({ systemState, width, height }) => {
	const fullTree = buildFullTree(systemState);
	const svgRef = useRef<SVGSVGElement>(null);
	const colors = useColorProvider();

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const tr = d3.transition().duration(1000).ease(d3.easeCubicInOut);
		const svg = d3.select(svgRef.current);
		const group = svg.select(".chart");

		const tree = d3.hierarchy(fullTree);
		const pack = d3
			.pack<TreeNode>()
			.radius(() => 20)
			.padding(20);
		pack(tree);

		group
			.select(".nodes")
			.selectAll("circle")
			.data(tree.descendants())
			.join("circle")
			.filter(d => d.data.group !== "root")
			.attr("class", "node")
			.transition(tr)
			.attr("cx", (d: any) => d.x)
			.attr("cy", (d: any) => d.y)
			.attr("r", (d: any) => d.r)
			.attr("fill", (d: any) => colors.assign(d.data.group))
			.attr("stroke", "#fff")
			.attr("stroke-width", 1.5);

		group
			.select(".texts")
			.selectAll("text")
			.data(tree.descendants())
			.join("text")
			.filter(d => d.data.group !== "root" && d.data.group !== "room")
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
