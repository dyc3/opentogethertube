import React from "react";
import ForceGraph, { Link, Node } from "components/ForceGraph";
import type { SystemState } from "types";
import { aggMonolithRooms, countRoomClients } from "aggregate";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

function buildGraph(state: SystemState): [Node[], Link[]] {
	const nodes: Node[] = [];
	const links: Link[] = [];
	const core: Node = {
		id: "core",
		radius: 15,
		x: 0,
		y: 0,
		group: "core",
		color: "Purple", // TODO: use color from grafana theme/panel options
	};
	nodes.push(core);

	const roomCounts = countRoomClients(state);
	const monolithRooms = aggMonolithRooms(state);

	const monoliths: Node[] = [];
	for (const [monolith, rooms] of Object.entries(monolithRooms)) {
		const monolithNode: Node = {
			id: monolith,
			radius: 10,
			x: 0,
			y: 0,
			group: "monolith",
			color: "Red", // TODO: use color from grafana theme/panel options
		};
		nodes.push(monolithNode);
		monoliths.push(monolithNode);

		links.push({
			source: core.id,
			target: monolith,
			value: 10,
		});

		for (const room of rooms) {
			const roomNode: Node = {
				id: room,
				radius: 7,
				x: 0,
				y: 0,
				group: "Room",
				color: "Blue", // TODO: use color from grafana theme/panel options
			};
			nodes.push(roomNode);

			links.push({
				source: monolith,
				target: room,
				value: 5,
			});

			const clients = roomCounts[room];
			if (clients) {
				for (let i = 0; i < clients; i++) {
					const clientNode: Node = {
						id: `${room}-client-${i}`,
						radius: 4,
						x: 0,
						y: 0,
						group: "Client",
						color: "Blue", // TODO: use color from grafana theme/panel options
					};
					nodes.push(clientNode);

					links.push({
						source: room,
						target: clientNode.id,
						value: 3,
					});
				}
			}
		}
	}

	return [nodes, links];
}

export const GlobalView: React.FC<Props> = ({ systemState, width, height }) => {
	const [nodes, links] = buildGraph(systemState);
	const data = { nodes, links };
	return (
		<div>
			<ForceGraph height={height} width={width} data={data} />
		</div>
	);
};

export default GlobalView;
