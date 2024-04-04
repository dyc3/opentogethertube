import { useEffect, useState } from "react";
import * as d3 from "d3";

export function useD3Zoom(svgRef: React.MutableRefObject<SVGSVGElement | null>) {
	const [chartTransform, setChartTransform] = useState("translate(0, 0)");
	// run this only once after the first render
	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select<SVGSVGElement, any>(svgRef.current);
		svg.select("g.chart").attr("transform", chartTransform);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		const svg = d3.select(svgRef.current);
		const zoom = d3.zoom<SVGSVGElement, any>().on("zoom", handleZoom);
		function handleZoom(e: any) {
			svg.select("g.chart").attr("transform", e.transform);
			setChartTransform(e.transform);
		}
		svg.call(zoom);
	}, [svgRef, chartTransform]);
}
