import { useColorProvider } from "colors";
import "./legend.css";
import React from "react";

const Legend: React.FC = () => {
	const color = useColorProvider();
	const thingWithColor = color.getAssignments();

	const legendItems = Array.from(thingWithColor.entries()).map(([thing, color]) => (
		<li key={thing} style={{ color }}>
			{thing}
		</li>
	));
	return (
		<div className="legendBox">
			Legend:
			<ul>{{legendItems}</ul>
		</div>
	);
};

export default Legend;
