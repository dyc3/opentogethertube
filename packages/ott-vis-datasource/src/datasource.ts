import {
	DataQueryRequest,
	DataQueryResponse,
	DataSourceApi,
	DataSourceInstanceSettings,
	MutableDataFrame,
	FieldType,
} from "@grafana/data";

import { MyQuery, MyDataSourceOptions } from "./types";
import { getBackendSrv } from "@grafana/runtime";
import type { SystemState } from "ott-vis";
import { lastValueFrom } from "rxjs";

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
	baseUrl: string;

	constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
		super(instanceSettings);
		this.baseUrl = instanceSettings.jsonData.baseUrl;
	}

	async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
		const response = getBackendSrv().fetch<SystemState>({
			url: `${this.baseUrl}/state`,
		});
		const systemState = (await lastValueFrom(response)).data;

		// Return a constant for each query.
		const data = options.targets.map(target => {
			return new MutableDataFrame({
				refId: target.refId,
				fields: [{ name: "Balancers", values: [systemState], type: FieldType.other }],
			});
		});

		return { data };
	}

	async testDatasource() {
		const obs = getBackendSrv().fetch({
			url: `${this.baseUrl}/status`,
		});
		const resp = await lastValueFrom(obs);

		if (resp.status !== 200) {
			return {
				status: "error",
				message: `Got HTTP status ${resp.status} from server: ${resp.statusText}`,
			};
		}

		return {
			status: "success",
			message: "Success",
		};
	}
}
