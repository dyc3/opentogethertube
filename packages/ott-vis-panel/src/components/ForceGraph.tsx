import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useEventBus } from "eventbus";

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
	text?: string;
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

	const links: Link[] = data.links;
	const nodes: Node[] = data.nodes;

	// Create a simulation with several forces.
	const simulation = d3
		.forceSimulation(nodes)
		.force(
			"link",
			d3
				.forceLink<Node, Link>(links)
				.id(d => d.id)
				.distance(d => {
					if (typeof d.source === "object") {
						if (d.source.group === "monolith") {
							return 100;
						} else if (d.source.group === "room") {
							return 50;
						} else if (d.source.group === "client") {
							return 10;
						}
					}
					return 100;
				})
		)
		.force("charge", d3.forceManyBody())
		.force("center", d3.forceCenter())
		.force(
			"radial",
			d3.forceRadial(d => {
				if (d.group === "monolith") {
					return 100;
				} else if (d.group === "room") {
					return 150;
				} else if (d.group === "client") {
					return 200;
				} else {
					return 0;
				}
			})
		);

	useEffect(() => {
		const svg = d3.select(svgRef.current);

		// Add a line for each link, and a circle for each node.
		const link = svg.select("g.links").selectAll("line").data(links);

		const node = svg.select("g.nodes").selectAll("circle").data(nodes);
		const nodeText = svg.select("g.nodes").selectAll("text").data(nodes);

		// node.append("title").text(d => d.id);

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
			nodeText.attr("x", d => d.x).attr("y", d => d.y + 4);
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

		const zoom = d3.zoom().on("zoom", handleZoom);
		function handleZoom(e: any) {
			svg.select("g.chart").attr("transform", e.transform);
		}
		// @ts-expect-error this works fine
		svg.call(zoom);
	});

	function radius(num: number) {
		return num * 2;
	}

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
			style={{ height: "auto", maxWidth: "100%" }}
		>
			<g className="chart">
				<g className="links" stroke="#999" strokeOpacity={0.6}>
					{links.map((link, i) => (
						<line key={i} strokeWidth={Math.sqrt(link.value)} />
					))}
				</g>
				<g className="nodes" stroke="#fff" strokeWidth={1.5}>
					{nodes.map((node, i) => (
						<>
							<circle
								key={i}
								r={radius(node.radius)}
								fill={color(node.group)}
								data-nodeid={node.id}
							/>
							<text
								textAnchor="middle"
								alignmentBaseline="middle"
								style={{
									userSelect: "none",
									cursor: "default",
									pointerEvents: "none",
								}}
								fontFamily="Inter, Helvetica, Arial, sans-serif"
								fontSize={10}
								strokeWidth={0}
								fill="#fff"
							>
								{node.text}
							</text>
						</>
					))}
				</g>
			</g>
		</svg>
	);
};

export default ForceGraph;
