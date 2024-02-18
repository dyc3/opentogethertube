import React from "react";
import { PanelProps } from "@grafana/data";
import type { CoreOptions } from "types";
import type { SystemState } from "ott-vis-common";
import { css, cx } from "@emotion/css";
import { useStyles2 } from "@grafana/ui";
import GlobalView from "./views/GlobalView";
import RegionView from "./views/RegionView";

interface Props extends PanelProps<CoreOptions> {}

const getStyles = () => {
	return {
		wrapper: css`
			font-family: Open Sans;
			position: relative;
		`,
		svg: css`
			position: absolute;
			top: 0;
			left: 0;
		`,
		textBox: css`
			position: absolute;
			bottom: 0;
			left: 0;
			padding: 10px;
		`,
	};
};

const sampleSystemState: SystemState = [
	{
		id: "154d9d41-128c-45ab-83d8-28661882c9e3",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 2 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 3 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "c91d183c-980e-4160-b196-43658148f469",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 1 },
					{ name: "bar", clients: 2 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0",
		region: "cdg",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 0 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 4 }],
			},
		],
	},
];

export const CorePanel: React.FC<Props> = ({ options, data, width, height }) => {
	const styles = useStyles2(getStyles);

	let view;
	if (options.view === "global") {
		view = <GlobalView height={height} width={width} systemState={sampleSystemState} />;
	} else if (options.view === "region") {
		view = <RegionView height={height} width={width} systemState={sampleSystemState} />;
	} else {
		view = <div>Invalid view</div>;
	}

	return (
		<div
			className={cx(
				styles.wrapper,
				css`
					width: ${width}px;
					height: ${height}px;
				`
			)}
		>
			{view}
		</div>
	);
};
