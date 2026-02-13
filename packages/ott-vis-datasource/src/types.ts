import type { DataSourceJsonData } from "@grafana/data";
import type { DataQuery } from "@grafana/schema";

export interface MyQuery extends DataQuery {
	queryText?: string;
	constant: number;
	stream: boolean;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
	constant: 6.5,
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
	baseUrl: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
	apiKey?: string;
}
