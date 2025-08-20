import { DataSourcePlugin } from "@grafana/data";
import { ConfigEditor } from "./components/ConfigEditor";
import { QueryEditor } from "./components/QueryEditor";
import { DataSource } from "./datasource";
import { MyDataSourceOptions, MyQuery } from "./types";

export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
	.setConfigEditor(ConfigEditor)
	.setQueryEditor(QueryEditor);
