import React from "react";
import { PanelProps } from "@grafana/data";
import type { CoreOptions } from "types";
import { css, cx } from "@emotion/css";
import { useStyles2 } from "@grafana/ui";
import GlobalView from "./views/GlobalView";
import RegionView from "./views/RegionView";

interface Props extends PanelProps<CoreOptions> {}

const getStyles = () => {
	return {
		wrapper: css`
			font-family: Open Sans;
			position: relative;
		`,
		svg: css`
			position: absolute;
			top: 0;
			left: 0;
		`,
		textBox: css`
			position: absolute;
			bottom: 0;
			left: 0;
			padding: 10px;
		`,
	};
};

export const CorePanel: React.FC<Props> = ({ options, data, width, height }) => {
	const styles = useStyles2(getStyles);

	let view;
	if (options.view === "global") {
		view = <GlobalView height={height} width={width} systemState={[]} />;
	} else if (options.view === "region") {
		view = <RegionView height={height} width={width} systemState={[]} />;
	} else {
		view = <div>Invalid view</div>;
	}

	return (
		<div
			className={cx(
				styles.wrapper,
				css`
					width: ${width}px;
					height: ${height}px;
				`
			)}
		>
			{view}
		</div>
	);
};
