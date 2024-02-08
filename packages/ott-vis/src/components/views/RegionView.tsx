import React from "react";

import type { SystemState } from "types";

interface Props {
	systemState: SystemState;
	width: number;
	height: number;
}

export const RegionView: React.FC<Props> = ({ width, height }) => {
	return <div>Region view</div>
};

export default RegionView;
