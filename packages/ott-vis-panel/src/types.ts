import type { TreeDisplayStyleProps } from "components/TreeDisplay";

export interface CoreOptions {
	view: "global" | "region" | "tree";
	useSampleData: boolean;

	tree: TreeDisplayStyleProps;
}
