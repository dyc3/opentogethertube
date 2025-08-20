import { css, cx } from "@emotion/css";
import { PanelProps } from "@grafana/data";
import { LoadingState } from "@grafana/schema";
import { useStyles2 } from "@grafana/ui";
import { useColorProvider } from "colors";
import { type BusEvent, useEventBus } from "eventbus";
import type { SystemState } from "ott-vis";
import React, { useEffect, useMemo, useState } from "react";
import type { CoreOptions } from "types";
import Legend from "./Legend";
import RegionView from "./views/RegionView";
import { TopologyView } from "./views/TopologyView";
import TreeView from "./views/TreeView";

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

export const CorePanel: React.FC<Props> = props => {
	const { data } = props;

	if (data.state === LoadingState.Error) {
		return <CoreError data={data} />;
	}

	return <CoreData {...props} />;
};

/**
 * Shown when the data source is in a nominal state.
 */
const CoreData: React.FC<Props> = ({ options, data, width, height }) => {
	const styles = useStyles2(getStyles);

	const stateSeries = data.series[0];
	const eventBusSeries = data.series[1];
	const eventBus = useEventBus();

	if (!stateSeries) {
		console.log("No state series, data:", data);
	}

	const systemState: SystemState = useMemo(() => {
		return options.useSampleData
			? sampleSystemState
			: (stateSeries.fields.find(f => f.name === "Balancers")?.values[0] ?? []);
	}, [options.useSampleData, stateSeries]);

	const { assign: assignColor, assignments: colorAssignments } = useColorProvider();

	// biome-ignore lint/correctness/useExhaustiveDependencies: biome migration
	let view = useMemo(() => {
		if (options.view === "region") {
			return (
				<RegionView
					height={height}
					width={width}
					systemState={systemState}
					assignColor={assignColor}
				/>
			);
		} else if (options.view === "tree") {
			return (
				<TreeView
					height={height}
					width={width}
					systemState={systemState}
					assignColor={assignColor}
					{...options.nodes}
					{...options.tree}
				/>
			);
		} else if (options.view === "topology") {
			return (
				<TopologyView
					height={height}
					width={width}
					systemState={systemState}
					assignColor={assignColor}
					{...options.nodes}
					{...options.topology}
				/>
			);
		} else {
			return <div>Invalid view</div>;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options.view, options.nodes, options.tree, options.topology, height, width, systemState]);

	const [readEvents, setReadEvents] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: biome migration
	useEffect(() => {
		if (!eventBusSeries) {
			return;
		}
		if (eventBusSeries.length === readEvents && readEvents > 0) {
			const event: BusEvent = {
				timestamp: "",
				event: "",
				node_id: "",
				direction: "tx",
			};

			eventBusSeries.fields.forEach(field => {
				event[field.name as keyof BusEvent] = field.values[field.values.length - 1];
			});
			eventBus.next(event);
		} else {
			for (let i = readEvents; i < eventBusSeries.length; i++) {
				const event: BusEvent = {
					timestamp: "",
					event: "",
					node_id: "",
					direction: "tx",
				};

				eventBusSeries.fields.forEach(field => {
					event[field.name as keyof BusEvent] = field.values[i];
				});
				eventBus.next(event);
			}
			setReadEvents(eventBusSeries.length);
		}
	}, [eventBusSeries, readEvents, setReadEvents, eventBus]);

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
			{data.state === LoadingState.Loading ? <Loading /> : null}
			{view}
			<Legend assignments={colorAssignments} />
		</div>
	);
};

/**
 * Shown when the data source is in an error state.
 */
const CoreError: React.FC<Pick<Props, "data">> = ({ data }) => {
	return (
		<div>
			Errors:
			{data.errors?.map((e, i) => (
				<div key={i}>{e.message}</div>
			))}
		</div>
	);
};

const Loading: React.FC = () => {
	return <div style={{ position: "absolute", top: 0, left: 0 }}>Loading...</div>;
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
					{
						name: "foo",
						clients: [
							{ id: "caa15370-8861-459e-997d-3e97f08f37d0", edge_region: "ewr" },
							{ id: "12726a0c-02de-49f0-ab59-d87baf9c289f", edge_region: "lga" },
						],
					},
					{ name: "bar", clients: [] },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [
					{
						name: "baz",
						clients: [
							{ id: "f3207419-b1d6-4c55-bc9d-799b4d1a70d7", edge_region: "ewr" },
							{ id: "0ecd5456-ba1f-4585-b64e-e76d2c515c17", edge_region: "lga" },
							{ id: "6ed66113-cbd4-46ec-8b56-dae6e80d4f31", edge_region: "lax" },
						],
					},
				],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: [] }],
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
					{
						name: "foo",
						clients: [
							{ id: "4ac25d42-b0d3-49ff-9c43-cf98e1fde1d8", edge_region: "ewr" },
						],
					},
					{
						name: "bar",
						clients: [
							{ id: "f2e74aa2-8dbe-44bc-a2ef-75d201bb7387", edge_region: "ewr" },
						],
					},
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: [] }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: [] }],
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
					{ name: "foo", clients: [] },
					{ name: "bar", clients: [] },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: [] }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [
					{
						name: "qux",
						clients: [
							{ id: "fe768adf-730a-4cc5-a7e3-2c3438a538c6", edge_region: "cdg" },
							{ id: "c4a6362a-61c8-45dd-9913-49f1bbccaeb9", edge_region: "bom" },
							{ id: "3e3389ff-d3c2-4814-8089-44cc7ec01eb4", edge_region: "lax" },
							{ id: "ddf9309a-8ace-4c53-9dd8-f742e9f282c3", edge_region: "ewr" },
						],
					},
				],
			},
		],
	},
];
