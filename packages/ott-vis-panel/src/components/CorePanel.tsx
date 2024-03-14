import React, { useEffect, useMemo, useState } from "react";
import { PanelProps } from "@grafana/data";
import type { CoreOptions } from "types";
import type { SystemState } from "ott-vis";
import { css, cx } from "@emotion/css";
import { useStyles2 } from "@grafana/ui";
import GlobalView from "./views/GlobalView";
import RegionView from "./views/RegionView";
import { LoadingState } from "@grafana/schema";
import { useEventBus, type BusEvent } from "eventbus";
import TreeDisplay from "./TreeDisplay";

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

export const CorePanel: React.FC<Props> = ({ options, data, width, height }) => {
	const styles = useStyles2(getStyles);

	const stateSeries = data.series[0];
	const eventBusSeries = data.series[1];
	const eventBus = useEventBus();

	const systemState: SystemState = useMemo(() => {
		return options.useSampleData
			? sampleSystemState
			: stateSeries.fields.find(f => f.name === "Balancers")?.values[0] ?? [];
	}, [options.useSampleData, stateSeries]);

	let view = useMemo(() => {
		if (options.view === "global") {
			return <GlobalView height={height} width={width} systemState={systemState} />;
		} else if (options.view === "region") {
			return <RegionView height={height} width={width} systemState={systemState} />;
		} else if (options.view === "tree") {
			return <TreeDisplay height={height} width={width} systemState={systemState} />;
		} else {
			return <div>Invalid view</div>;
		}
	}, [options.view, height, width, systemState]);

	const [readEvents, setReadEvents] = useState(0);

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
			{data.state === LoadingState.Loading ? <div>Loading...</div> : null}
			{view}
		</div>
	);
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
