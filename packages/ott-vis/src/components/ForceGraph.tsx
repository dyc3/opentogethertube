import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

interface ForceGraphProps {
	data: {
		nodes: Node[];
		links: Link[];
	};
	width?: number;
	height?: number;
	marginTop?: number;
	marginRight?: number;
	marginBottom?: number;
	marginLeft?: number;
}

export interface Node extends d3.SimulationNodeDatum {
	id: string;
	x: number;
	y: number;
	group: string;
	color: string;
	radius: number;
}

export interface Link extends d3.SimulationLinkDatum<Node> {
	value: number;
}

const ForceGraph: React.FC<ForceGraphProps> = ({
	data,
	width = 640,
	height = 400,
	marginTop = 20,
	marginRight = 20,
	marginBottom = 50,
	marginLeft = 20,
}) => {
	const svgRef = useRef<SVGSVGElement>(null);
	// Specify the color scale.
	const color = d3.scaleOrdinal(d3.schemeCategory10);

	// The force simulation mutates links and nodes, so create a copy
	// so that re-evaluating this cell produces the same result.
	const links: Link[] = data.links.map((d: Link) => ({ ...d }));
	const nodes: Node[] = data.nodes.map((d: Node) => ({ ...d }));

	// Create a simulation with several forces.
	const simulation = d3
		.forceSimulation(nodes)
		.force(
			"link",
			d3.forceLink<Node, Link>(links).id(d => d.id)
		)
		.force("charge", d3.forceManyBody())
		.force("center", d3.forceCenter())
		.force("radial", d3.forceRadial(100))
		.force(
			"collide",
			d3.forceCollide(d => d.radius)
		);

	useEffect(() => {
		const svg = d3
			.select(svgRef.current)
			.attr("width", width)
			.attr("height", height)
			.attr("viewBox", [-width / 2, -height / 2, width, height])
			.attr("style", "max-width: 100%; height: auto;");
		svg.selectAll("*").remove();

		// Add a line for each link, and a circle for each node.
		const link = svg
			.append("g")
			.attr("stroke", "#999")
			.attr("stroke-opacity", 0.6)
			.selectAll("line")
			.data(links)
			.join("line")
			.attr("stroke-width", d => Math.sqrt(d.value));

		const node = svg
			.append("g")
			.attr("stroke", "#fff")
			.attr("stroke-width", 1.5)
			.selectAll("circle")
			.data(nodes)
			.join("circle")
			.attr("r", d => radius(d.radius))
			.attr("fill", d => color(d.group));

		node.append("title").text(d => d.id);

		// Add a drag behavior.
		node.call(
			// @ts-expect-error The types for d3-drag are incorrect.
			d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended)
		);

		// Set the position attributes of links and nodes each time the simulation ticks.
		simulation.on("tick", () => {
			link.attr("x1", d => (d.source as Node).x ?? 0)
				.attr("y1", d => (d.source as Node).y ?? 0)
				.attr("x2", d => (d.target as Node).x ?? 0)
				.attr("y2", d => (d.target as Node).y ?? 0);

			node.attr("cx", d => d.x).attr("cy", d => d.y);
		});

		// Reheat the simulation when drag starts, and fix the subject position.
		function dragstarted(event: d3.D3DragEvent<SVGCircleElement, unknown, Node>) {
			if (!event.active) {
				simulation.alphaTarget(0.3).restart();
			}
			event.subject.fx = event.subject.x;
			event.subject.fy = event.subject.y;
		}

		// Update the subject (dragged node) position during drag.
		function dragged(event: d3.D3DragEvent<SVGCircleElement, unknown, Node>) {
			event.subject.fx = event.x;
			event.subject.fy = event.y;
		}

		// Restore the target alpha so the simulation cools after dragging ends.
		// Unfix the subject position now that it’s no longer being dragged.
		function dragended(event: d3.D3DragEvent<SVGCircleElement, unknown, Node>) {
			if (!event.active) {
				simulation.alphaTarget(0);
			}
			event.subject.fx = null;
			event.subject.fy = null;
		}

		function radius(num: number) {
			return num * 2;
		}
	});

	return <svg ref={svgRef} />;
};

export default ForceGraph;
