import type { TreeDisplayStyleProps } from "components/TreeDisplay";
import type { TopologyViewStyleProps } from "components/views/TopologyView";

export interface CoreOptions {
	view: "global" | "region" | "tree" | "topology";
	useSampleData: boolean;

	tree: TreeDisplayStyleProps;
	topology: TopologyViewStyleProps;
	nodes: NodeRadiusOptions;
}

export interface NodeRadiusOptions {
	baseNodeRadius?: number;
	balancerNodeRadius?: number;
	clientNodeRadius?: number;
}
