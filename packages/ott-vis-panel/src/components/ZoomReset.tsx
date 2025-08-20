import { Button } from "@grafana/ui";
import React from "react";
import "./zoom-reset.css";

interface ZoomResetProps {
	onClick: () => void;
}

const ZoomReset: React.FC<ZoomResetProps> = props => {
	return (
		<Button className="zoom-reset" size="sm" variant="secondary" onClick={props.onClick}>
			Reset Zoom
		</Button>
	);
};

export default ZoomReset;
