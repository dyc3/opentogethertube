import {
	CircularDataFrame,
	DataQueryRequest,
	DataQueryResponse,
	DataSourceApi,
	DataSourceInstanceSettings,
	FieldType,
	LoadingState,
	MutableDataFrame,
} from "@grafana/data";
import { getBackendSrv } from "@grafana/runtime";
import type { SystemState } from "ott-vis";
import { lastValueFrom, merge, Observable } from "rxjs";
import { MyDataSourceOptions, MyQuery } from "./types";

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
	baseUrl: string;

	constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
		super(instanceSettings);
		this.baseUrl = instanceSettings.jsonData.baseUrl;
		console.log("Datasource created");
	}

	query(options: DataQueryRequest<MyQuery>): Observable<DataQueryResponse> {
		const observables = options.targets.map(target => {
			if (target.stream) {
				return new Observable<DataQueryResponse>(subscriber => {
					const frame = new CircularDataFrame({
						append: "tail",
						capacity: 1000,
					});

					frame.refId = target.refId;
					frame.addField({ name: "timestamp", type: FieldType.time });
					frame.addField({ name: "event", type: FieldType.string });
					frame.addField({ name: "balancer_id", type: FieldType.string });
					frame.addField({ name: "node_id", type: FieldType.string });
					frame.addField({ name: "direction", type: FieldType.string });
					frame.addField({ name: "room", type: FieldType.string });

					const base = this.baseUrl.replace(/^http/, "ws");

					const open = (e: Event) => {
						console.log("WebSocket opened", e);
					};

					const message = (msg: MessageEvent) => {
						const event = JSON.parse(msg.data);
						frame.add(event);

						subscriber.next({
							data: [frame],
							key: frame.refId,
							state: LoadingState.Streaming,
						});
					};

					const error = (err: Event) => {
						console.error("WebSocket error", err);
					};

					const close = (e: CloseEvent) => {
						// subscriber.complete();
						console.warn("WebSocket closed", e);
						if (e.code === 4132) {
							console.info("We aborted the connection.");
							return;
						}
						console.log("Datasource reconnecting...");
						setTimeout(() => {
							if (socket) {
								removeListeners(socket);
							}
							socket = new WebSocket(`${base}/state/stream`);
							addListeners(socket);
						}, 1000);
					};

					function addListeners(ws: WebSocket) {
						ws.addEventListener("open", open);
						ws.addEventListener("message", message);
						ws.addEventListener("error", error);
						ws.addEventListener("close", close);
					}
					function removeListeners(ws: WebSocket) {
						ws.removeEventListener("open", open);
						ws.removeEventListener("message", message);
						ws.removeEventListener("error", error);
						ws.removeEventListener("close", close);
					}

					function teardown(this: DataSource) {
						if (!socket) {
							return;
						}
						socket.close(4132);
						removeListeners(socket);
						window.removeEventListener("beforeunload", teardown);
					}
					subscriber.add(teardown.bind(this));
					window.addEventListener("beforeunload", teardown);

					let socket = new WebSocket(`${base}/state/stream`);
					addListeners(socket);
				});
			}

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
