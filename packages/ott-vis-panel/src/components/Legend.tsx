import React from "react";
import "./legend.css";

interface LegendProps {
	assignments: Map<string, string>;
}

const Legend: React.FC<LegendProps> = ({ assignments }) => {
	const legendItems = Array.from(assignments.entries()).map(([thing, color]) => (
		<li key={thing}>
			<span className="legendCircle" style={{ backgroundColor: color }}></span>
			<span className="legendText">{thing}</span>
		</li>
	));
	return (
		<div className="legendBox">
			Legend:
			<ul>{legendItems}</ul>
		</div>
	);
};

export default Legend;
