import { PanelPlugin } from "@grafana/data";
import { SimpleOptions } from "./types";
import { SimplePanel } from "./components/SimplePanel";

export const plugin = new PanelPlugin<SimpleOptions>(SimplePanel).setPanelOptions(builder => {
	return builder
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
