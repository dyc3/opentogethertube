// biome-ignore lint/style/useImportType: migrating to biome, maybe false positive
import React from "react";
import { Button } from "@grafana/ui";
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
