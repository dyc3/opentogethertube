import { QueryEditorProps } from "@grafana/data";
import { InlineField, Input } from "@grafana/ui";
import React, { ChangeEvent } from "react";
import { DataSource } from "../datasource";
import { MyDataSourceOptions, MyQuery } from "../types";

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
	const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
		onChange({ ...query, queryText: event.target.value });
	};

	const onConstantChange = (event: ChangeEvent<HTMLInputElement>) => {
		onChange({ ...query, constant: parseFloat(event.target.value) });
		// executes the query
		onRunQuery();
	};

	const onQueryStreamChange = (event: ChangeEvent<HTMLInputElement>) => {
		onChange({ ...query, stream: event.target.checked });
	};

	const { queryText, constant, stream } = query;

	return (
		<div className="gf-form">
			<InlineField label="Constant">
				<Input
					onChange={onConstantChange}
					value={constant}
					width={8}
					type="number"
					step="0.1"
				/>
			</InlineField>
			<InlineField
				label="Query Text"
				labelWidth={16}
				tooltip="Not used yet"
				data-testid="vis-query-text"
			>
				<Input onChange={onQueryTextChange} value={queryText || ""} />
			</InlineField>
			<InlineField label="Stream">
				<Input
					type="checkbox"
					onChange={onQueryStreamChange}
					checked={stream}
					data-testid="vis-stream"
				/>
			</InlineField>
		</div>
	);
}
