import React from "react";
import ForceGraph, { Link, Node } from "components/ForceGraph";
import type { SystemState } from "ott-vis-common";
import { aggMonolithRooms, countRoomClients, groupMonolithsByRegion } from "aggregate";
import _ from "lodash";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

const COLORS = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"]; // TODO: use color from grafana theme/panel options

function buildGraph(state: SystemState): [Node[], Link[]] {
	const nodes: Node[] = [];
	const links: Link[] = [];

	const monolithRegions = groupMonolithsByRegion(state);
	const monolithRooms = aggMonolithRooms(state);
	const roomCounts = countRoomClients(state);

	const regions = Object.keys(monolithRegions);
	const regionColors: Record<string, string> = {};
	for (let i = 0; i < regions.length; i++) {
		regionColors[regions[i]] = COLORS[i % COLORS.length];
	}

	for (const [region, monoliths] of Object.entries(monolithRegions)) {
		const core: Node = {
			id: region,
			radius: 12,
			x: 0,
			y: 0,
			group: "core",
			color: regionColors[region],
		};
		nodes.push(core);

		for (const monolith of monoliths) {
			const monolithNode: Node = {
				id: monolith,
				radius: 10,
				x: 0,
				y: 0,
				group: "monolith",
				color: regionColors[region],
			};
			nodes.push(monolithNode);

			links.push({
				source: core.id,
				target: monolith,
				value: 10,
			});

			for (const room of monolithRooms[monolith]) {
				const roomNode: Node = {
					id: room,
					radius: 7,
					x: 0,
					y: 0,
					group: "room",
					color: regionColors[region],
				};
				nodes.push(roomNode);

				links.push({
					source: monolith,
					target: room,
					value: 10,
				});

				const clients = roomCounts[room];
				const clientsNode: Node = {
					id: `${room}-clients`,
					radius: clients,
					x: 0,
					y: 0,
					group: "client",
					color: regionColors[region],
				};
				nodes.push(clientsNode);

				links.push({
					source: room,
					target: clientsNode.id,
					value: 10,
				});
			}
		}
	}

	return [nodes, links];
}

export const RegionView: React.FC<Props> = ({ systemState, width, height }) => {
	const [nodes, links] = buildGraph(systemState);
	const data = { nodes, links };
	return (
		<div>
			<ForceGraph width={width} height={height} data={data} />
		</div>
	);
};

export default RegionView;
