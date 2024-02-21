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
				],
			},
		})
		.addBooleanSwitch({
			path: "useSampleData",
			name: "Use Sample Data",
			description: "Use sample data instead of querying the datasource",
		});
});
