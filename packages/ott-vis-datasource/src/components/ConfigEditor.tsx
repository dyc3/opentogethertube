import { DataSourcePluginOptionsEditorProps } from "@grafana/data";
import { InlineField, Input, SecretInput } from "@grafana/ui";
import React, { ChangeEvent } from "react";
import { MyDataSourceOptions, MySecureJsonData } from "../types";

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor(props: Props) {
	const { onOptionsChange, options } = props;
	const onBaseUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
		// biome-ignore lint/nursery/noShadow: biome migration
		const jsonData = {
			...options.jsonData,
			baseUrl: event.target.value,
		};
		onOptionsChange({ ...options, jsonData });
	};

	// Secure field (only sent to the backend)
	const onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
		onOptionsChange({
			...options,
			secureJsonData: {
				apiKey: event.target.value,
			},
		});
	};

	const onResetAPIKey = () => {
		onOptionsChange({
			...options,
			secureJsonFields: {
				...options.secureJsonFields,
				apiKey: false,
			},
			secureJsonData: {
				...options.secureJsonData,
				apiKey: "",
			},
		});
	};

	const { jsonData, secureJsonFields } = options;
	const secureJsonData = (options.secureJsonData || {}) as MySecureJsonData;

	return (
		<div className="gf-form-group">
			<InlineField label="Base URL" labelWidth={12}>
				<Input
					onChange={onBaseUrlChange}
					value={jsonData.baseUrl || ""}
					placeholder="URL to ott-collector"
					width={40}
				/>
			</InlineField>
			<InlineField label="API Key" labelWidth={12}>
				<SecretInput
					isConfigured={(secureJsonFields && secureJsonFields.apiKey) as boolean}
					value={secureJsonData.apiKey || ""}
					placeholder="secure json field (backend only)"
					width={40}
					onReset={onResetAPIKey}
					onChange={onAPIKeyChange}
				/>
			</InlineField>
		</div>
	);
}
