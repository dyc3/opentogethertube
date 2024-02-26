import {
	DataQueryRequest,
	DataQueryResponse,
	DataSourceApi,
	DataSourceInstanceSettings,
	MutableDataFrame,
	FieldType,
} from "@grafana/data";

import { MyQuery, MyDataSourceOptions } from "./types";
import type { SystemState } from "ott-vis-common";
import axios from "axios";

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
	constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
		super(instanceSettings);
	}

	async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
		// const { range } = options;
		// const from = range!.from.valueOf();
		// const to = range!.to.valueOf();
		let system_state: SystemState = [
			{
				id: "ERR",
				region: "ERR",
				monoliths: []
			}
		];

		axios.get('localhost:8000/state')
  			.then(function (response) {
  			  system_state = response.data;
  			  console.log(response);
  			})
  			.catch(function (error) {
  			  // handle error
  			  console.log(error);
  			});


		// Return a constant for each query.
		const data = options.targets.map(target => {
			return new MutableDataFrame({
				refId: target.refId,
				fields: [{ name: "Balancers", values: [system_state], type: FieldType.other }],
			});
		});

		return { data };
	}

	async testDatasource() {
		// Implement a health check for your data source.
		return {
			status: "success",
			message: "Success",
		};
	}
}

const sampleSystemState: SystemState = [
	{
		id: "154d9d41-128c-45ab-83d8-28661882c9e3",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 2 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 3 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "c91d183c-980e-4160-b196-43658148f469",
		region: "ewr",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 1 },
					{ name: "bar", clients: 2 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 0 }],
			},
		],
	},
	{
		id: "5a2e3b2d-f27b-4e3d-9b59-c921442f7ff0",
		region: "cdg",
		monoliths: [
			{
				id: "2bd5e4a7-14f6-4da4-bedd-72946864a7bf",
				region: "ewr",
				rooms: [
					{ name: "foo", clients: 0 },
					{ name: "bar", clients: 0 },
				],
			},
			{
				id: "419580cb-f576-4314-8162-45340c94bae1",
				region: "ewr",
				rooms: [{ name: "baz", clients: 0 }],
			},
			{
				id: "0c85b46e-d343-46a3-ae4f-5f2aa1a8bdac",
				region: "cdg",
				rooms: [{ name: "qux", clients: 4 }],
			},
		],
	},
];
