import type { TreeViewStyleProps } from "components/views/TreeView";
import type { TopologyViewStyleProps } from "components/views/TopologyView";

export interface CoreOptions {
	view: "global" | "region" | "tree" | "topology";
	useSampleData: boolean;

	tree: TreeViewStyleProps;
	topology: TopologyViewStyleProps;
	nodes: NodeRadiusOptions;
}

export interface NodeRadiusOptions {
	baseNodeRadius?: number;
	balancerNodeRadius?: number;
	clientNodeRadius?: number;
}
