import React from "react";
import ForceGraph, { Link, Node } from "components/ForceGraph";
import type { SystemState } from "types";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

export const GlobalView: React.FC<Props> = ({ width, height }) => {
	return (
		<div>
			<ForceGraph height={height} width={width} data={sample_data} />
		</div>
	);
}

const sample_data = {
	nodes: [
		{
			id: "B1",
			group: "Balancer",
			color: "Purple",
			radius: 15,
		},
		{
			id: "M1",
			group: "Monolith",
			color: "Red",
			radius: 10,
		},
		{
			id: "M2",
			group: "Monolith",
			color: "Red",
			radius: 10,
		},
		{
			id: "R1",
			group: "Room",
			color: "Blue",
			radius: 7,
		},
		{
			id: "R2",
			group: "Room",
			color: "Blue",
			radius: 7,
		},
		{
			id: "R3",
			group: "Room",
			color: "Blue",
			radius: 7,
		},
		{
			id: "R4",
			group: "Room",
			color: "Blue",
			radius: 7,
		},
		{
			id: "C1",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C2",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C3",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C4",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C5",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C6",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C7",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C8",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
		{
			id: "C9",
			group: "Client",
			color: "Blue",
			radius: 4,
		},
	] as Node[],
	links: [
		{
			source: "B1",
			target: "M1",
			value: 10,
		},
		{
			source: "B1",
			target: "M2",
			value: 10,
		},
		{
			source: "M1",
			target: "R1",
			value: 5,
		},
		{
			source: "M1",
			target: "R2",
			value: 5,
		},
		{
			source: "M2",
			target: "R3",
			value: 5,
		},
		{
			source: "M2",
			target: "R4",
			value: 5,
		},
		{
			source: "R1",
			target: "C1",
			value: 5,
		},
		{
			source: "R1",
			target: "C2",
			value: 3,
		},
		{
			source: "R2",
			target: "C3",
			value: 3,
		},
		{
			source: "R2",
			target: "C4",
			value: 3,
		},
		{
			source: "R3",
			target: "C5",
			value: 3,
		},
		{
			source: "R3",
			target: "C6",
			value: 3,
		},
		{
			source: "R4",
			target: "C7",
			value: 3,
		},
		{
			source: "R4",
			target: "C8",
			value: 3,
		},
		{
			source: "R4",
			target: "C9",
			value: 3,
		},
	] as Link[],
};

export default GlobalView;
