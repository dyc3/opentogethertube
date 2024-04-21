import { useEffect, useState } from "react";
import * as d3 from "d3";
import { useEventBus, type BusEvent } from "eventbus";
import type { TreeNode } from "treeutils";

export function useD3Zoom(svgRef: React.MutableRefObject<SVGSVGElement | null>) {
	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select(svgRef.current);
		const zoom = d3.zoom<SVGSVGElement, any>().on("zoom", handleZoom);
		function handleZoom(e: any) {
			svg.select("g.chart").attr("transform", e.transform);
		}
		svg.call(zoom);
	}, [svgRef]);
}

export function useD3AutoZoom(svgRef: React.MutableRefObject<SVGSVGElement | null>) {
	const [enableAutoZoom, setEnableAutoZoom] = useState(true);
	const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select<SVGSVGElement, TreeNode>(svgRef.current);
		const zoom = d3.zoom<SVGSVGElement, any>().on("zoom", handleZoom);
		function handleZoom(e: { transform: d3.ZoomTransform; sourceEvent: any }) {
			svg.select("g.chart").attr("transform", e.transform.toString());
			if (e.sourceEvent) {
				setEnableAutoZoom(false);
			}
		}
		svg.call(zoom).on("dblclick.zoom", null);

		if (enableAutoZoom) {
			svg.transition("zoom").duration(1000).call(zoom.transform, transform);
		}
	}, [svgRef, transform, enableAutoZoom]);

	function resetZoom() {
		setEnableAutoZoom(true);
	}

	return {
		resetZoom,
		enableAutoZoom,
		transform,
		setTransform,
	};
}

export function useActivityAnimations(
	svgRef: React.MutableRefObject<SVGSVGElement | null>,
	getRadius: (group: string) => number
) {
	const eventBus = useEventBus();
	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

		const svg = d3.select<SVGSVGElement, d3.HierarchyNode<TreeNode>>(svgRef.current);
		const rxColor = "#0f0";
		const txColor = "#00f";
		const proxyColor = "#f58d05";

		function animateNode(
			node: d3.Selection<any, d3.HierarchyNode<TreeNode>, any, any>,
			color: string
		) {
			if (node.empty()) {
				return;
			}
			const data = node.data()[0] as d3.HierarchyNode<TreeNode>;
			const endRadius = data ? getRadius(data.data.group) : 20;
			let radiusCurrent = parseFloat(node.attr("r"));
			let colorCurrent = d3.color(node.attr("stroke"));
			if (isNaN(radiusCurrent)) {
				radiusCurrent = 0;
			}
			const newRadius = Math.max(Math.min(radiusCurrent + 5, 40), endRadius);
			const newColor = d3.interpolateRgb(colorCurrent?.formatRgb() ?? "#fff", color)(0.5);
			node.transition("highlight")
				.duration(333)
				.ease(d3.easeCubicOut)
				.attrTween("stroke", () => d3.interpolateRgb(newColor, "#fff"))
				.attrTween("stroke-width", () => t => d3.interpolateNumber(4, 1.5)(t).toString())
				.attrTween(
					"r",
					() => t => d3.interpolateNumber(newRadius, endRadius)(t).toString()
				);
		}

		function animateLinks(
			links: d3.Selection<any, d3.HierarchyLink<TreeNode>, any, any>,
			color: string
		) {
			links
				.transition("highlight")
				.duration(333)
				.ease(d3.easeCubicOut)
				.attrTween("stroke", function () {
					const link = d3.select<d3.BaseType, d3.HierarchyLink<TreeNode>>(
						this
					) as d3.Selection<any, d3.HierarchyLink<TreeNode>, any, unknown>;
					let colorCurrent = d3.color(link.attr("stroke"));
					const newColor = d3.interpolateRgb(
						colorCurrent?.formatRgb() ?? "#fff",
						color
					)(0.5);

					return d3.interpolateRgb(newColor, "#fff");
				})
				.attrTween("stroke-width", () => t => d3.interpolateNumber(4, 1.5)(t).toString());
		}

		function getColor(event: BusEvent): string {
			if (event.event === "ws" || event.event === "broadcast") {
				return event.direction === "rx" ? rxColor : txColor;
			} else if (event.event === "proxy") {
				return proxyColor;
			} else {
				return "#f00";
			}
		}

		const sub = eventBus.subscribe(event => {
			const color = getColor(event);
			const node = svg.select(`[data-nodeid="${event.node_id}"]`);
			animateNode(node, color);
			if (!node.empty()) {
				const parent = svg.select(`[data-nodeid="${node.datum().parent?.data.id}"]`);
				animateNode(parent, color);
			}

			const links = svg.selectAll<SVGSVGElement, d3.HierarchyLink<TreeNode>>(
				`[data-nodeid-target="${event.node_id}"]`
			);
			animateLinks(links, color);

			if (event.room) {
				const room = svg.select(`[data-nodeid="${event.room}"]`);
				animateNode(room, color);

				const roomLinks = svg.selectAll<SVGSVGElement, d3.HierarchyLink<TreeNode>>(
					`[data-nodeid-target="${event.room}"]`
				);
				animateLinks(roomLinks, color);
			}
		});

		return () => {
			sub.unsubscribe();
		};
	}, [svgRef, eventBus, getRadius]);
}
