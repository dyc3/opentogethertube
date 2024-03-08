import {
	DataQueryRequest,
	DataQueryResponse,
	DataSourceApi,
	DataSourceInstanceSettings,
	MutableDataFrame,
	FieldType,
	LoadingState,
} from "@grafana/data";

import { MyQuery, MyDataSourceOptions } from "./types";
import { getBackendSrv } from "@grafana/runtime";
import type { SystemState } from "ott-vis";
import { Observable, lastValueFrom, merge } from "rxjs";

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
	baseUrl: string;

	constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
		super(instanceSettings);
		this.baseUrl = instanceSettings.jsonData.baseUrl;
	}

	query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
		const observables = options.targets.map(target => {
			return new Observable<DataQueryResponse>(subscriber => {
				subscriber.next({
					data: [],
					state: LoadingState.Loading,
				});
				getBackendSrv()
					.fetch<SystemState>({
						url: `${this.baseUrl}/state`,
					})
					.subscribe(resp => {
						const systemState: SystemState = resp.data;
						const frame = new MutableDataFrame({
							refId: target.refId,
							fields: [
								{ name: "Balancers", values: [systemState], type: FieldType.other },
							],
						});
						subscriber.next({
							data: [frame],
							state: LoadingState.Done,
						});
						subscriber.complete();
					});
			});

		});

		return merge(...observables);
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
