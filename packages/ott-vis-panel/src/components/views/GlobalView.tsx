import React from "react";
import ForceGraph, { Link, Node } from "components/ForceGraph";
import type { SystemState } from "ott-vis";
import { aggMonolithRooms, countRoomClients } from "aggregate";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

export function buildGraph(state: SystemState): [Node[], Link[]] {
	let nodes: Node[] = [];
	const links: Link[] = [];
	const core: Node = {
		id: "core",
		radius: 15,
		x: 0,
		y: 0,
		group: "core",
		color: "Purple", // TODO: use color from grafana theme/panel options
		text: "OTT",
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
			text: monolith.substring(0, 6),
		};
		nodes.push(monolithNode);
		monoliths.push(monolithNode);

		links.push({
			source: core.id,
			target: monolith,
			value: 10,
		});

		for (const room of rooms) {
			let roomNode: Node;
			let numRooms = nodes.filter(node => node.group === "room").length;

			if (numRooms > 50) {
				nodes = nodes
					.filter((node, index): node is Node => node !== undefined && index % 2 === 0)
					.map(node => {
						if (node.group === "room") {
							return {
								...node,
								radius: node.radius * 2,
							};
						}
						return node;
					});
			} else {
				roomNode = {
					id: room,
					radius: 7,
					x: 0,
					y: 0,
					group: "room",
					color: "Blue", // TODO: use color from grafana theme/panel options
				};
				nodes.push(roomNode);
			}

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
						group: "client",
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
