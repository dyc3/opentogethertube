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
		.addTextInput({
			path: "text",
			name: "Allowed Entities",
			description: "Number of entities allowed to be displayed in the panel at one time",
			defaultValue: "25",
		})
		.addBooleanSwitch({
			path: "showSeriesCount",
			name: "Show series counter",
			defaultValue: false,
		})
		.addRadio({
			path: "seriesCountSize",
			defaultValue: "sm",
			name: "Series counter size",
			settings: {
				options: [
					{
						value: "sm",
						label: "Small",
					},
					{
						value: "md",
						label: "Medium",
					},
					{
						value: "lg",
						label: "Large",
					},
				],
			},
			showIf: config => config.showSeriesCount,
		});
});
