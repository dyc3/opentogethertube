import React from "react";
import ForceGraph, { Link, Node } from "components/ForceGraph";
import type { SystemState } from "ott-vis";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

function buildGraph(state: SystemState): [Node[], Link[]] {
	const nodes: Node[] = [];
	const links: Link[] = [];

	const monolithNodes: Map<string, Node> = new Map();

	for (const balancer of state) {
		const balancerNode: Node = {
			id: balancer.id,
			radius: 10,
			x: 0,
			y: 0,
			group: "balancer",
			color: "Green", // TODO: use color from grafana theme/panel options
			text: balancer.id.substring(0, 6),
		};
		nodes.push(balancerNode);

		for (const monolith of balancer.monoliths) {
			let monolithNode = monolithNodes.get(monolith.id);
			if (!monolithNode) {
				monolithNode = {
					id: monolith.id,
					radius: 10,
					x: 0,
					y: 0,
					group: "monolith",
					color: "Red", // TODO: use color from grafana theme/panel options
					text: monolith.id.substring(0, 6),
				};
				monolithNodes.set(monolith.id, monolithNode);
				nodes.push(monolithNode);
			}
		}
	}

	for (const monolith of monolithNodes.values()) {
		for (const balancer of state) {
			if (balancer.monoliths.map(m => m.id).includes(monolith.id)) {
				links.push({
					source: balancer.id,
					target: monolith.id,
					value: 10,
				});
			} else {
				links.push({
					source: balancer.id,
					target: monolith.id,
					value: 10,
					color: "#ff0000",
				});
			}
		}
	}

	return [nodes, links];
}

export const NodeView: React.FC<Props> = ({ systemState, width, height }) => {
	const [nodes, links] = buildGraph(systemState);
	const data = { nodes, links };
	return (
		<div>
			<ForceGraph height={height} width={width} data={data} />
		</div>
	);
};

export default NodeView;
