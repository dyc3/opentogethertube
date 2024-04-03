import { PanelPlugin } from "@grafana/data";
import { CoreOptions } from "./types";
import { CorePanel } from "./components/CorePanel";

export const plugin = new PanelPlugin<CoreOptions>(CorePanel).setPanelOptions(builder => {
	return builder
		.addSelect({
			path: "view",
			name: "View",
			description: "Select the view to display",
			defaultValue: "global",
			settings: {
				options: [
					{
						value: "global",
						label: "Global",
					},
					{
						value: "region",
						label: "Region",
					},
					{
						value: "tree",
						label: "Tree",
					},
				],
			},
		})
		.addBooleanSwitch({
			path: "useSampleData",
			name: "Use Sample Data",
			description: "Use sample data instead of querying the datasource",
		})
		.addBooleanSwitch({
			path: "tree.horizontal",
			name: "Horizontal",
			description: "Rotate the tree view 90 degrees so that it extends horizontally",
			showIf: config => config.view === "tree",
		})
		.addSelect({
			path: "tree.b2mLinkStyle",
			name: "Tree B2M Link Style",
			description: "Select the style of the B2M links in the tree view",
			defaultValue: "smooth",
			settings: {
				options: [
					{
						value: "smooth",
						label: "Smooth",
					},
					{
						value: "step",
						label: "Step",
					},
				],
			},
			showIf: config => config.view === "tree",
		})
		.addNumberInput({
			path: "tree.b2mSpacing",
			name: "Tree B2M Spacing",
			description: "Set the spacing between Balancer and Monolith nodes in the tree view",
			defaultValue: 300,
			showIf: config => config.view === "tree",
		})
		.addNumberInput({
			path: "tree.baseNodeRadius",
			name: "Tree Base Node Radius",
			description: "Set the radius of the nodes in the tree view",
			defaultValue: 20,
			showIf: config => config.view === "tree",
		})
		.addNumberInput({
			path: "tree.balancerNodeRadius",
			name: "Tree Balancer Node Radius",
			description: "Set the radius of the balancer nodes in the tree view",
			defaultValue: 30,
			showIf: config => config.view === "tree",
		})
		.addNumberInput({
			path: "tree.clientNodeRadius",
			name: "Tree Client Node Radius",
			description: "Set the radius of the client nodes in the tree view",
			defaultValue: 8,
			showIf: config => config.view === "tree",
		})
		.addSelect({
			path: "tree.balancerGroupStyle",
			name: "Tree Balancer Group Style",
			description: "Select the style of the balancer groups in the tree view",
			defaultValue: "stacked",
			settings: {
				options: [
					{
						value: "stacked",
						label: "Stacked",
					},
					{
						value: "region-packed",
						label: "Packed Circles by Region",
					},
				],
			},
			showIf: config => config.view === "tree",
		});
});
