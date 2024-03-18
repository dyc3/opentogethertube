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
		});
});
