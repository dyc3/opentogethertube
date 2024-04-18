import * as d3 from "d3";
import { useState } from "react";

interface ColorProvider {
	assign(thing: string): string;
	assignments: Map<string, string>;
}

export function useColorProvider(): ColorProvider {
	let [colorAssignments, setColorAssignments] = useState<Map<string, string>>(new Map());
	const color = d3.scaleOrdinal(d3.schemeCategory10);
	function assign(thing: string): string {
		if (!colorAssignments.has(thing)) {
			setColorAssignments(new Map(colorAssignments.set(thing, color(thing))));
		}
		return colorAssignments.get(thing)!;
	}

	return { assign, assignments: colorAssignments };
}
