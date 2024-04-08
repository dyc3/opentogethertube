import * as d3 from "d3";

class ColorProvider {
	private color = d3.scaleOrdinal(d3.schemeCategory10);
	private assignments: Map<string, string> = new Map();

	public assign(thing: string): string {
		if (!this.assignments.has(thing)) {
			this.assignments.set(thing, this.color(thing));
		}
		return this.assignments.get(thing)!;
	}

	public getAssignments(): Map<string, string> {
		return this.assignments;
	}
}

const provider = new ColorProvider();

export function useColorProvider(): ColorProvider {
	return provider;
}
