import {describe, expect, test} from '@jest/globals';
import { DataSource } from './datasource';
import { DataSourceInstanceSettings, DataQueryRequest, DataSourcePluginMeta, TimeRange, ScopedVars } from '@grafana/data';
import { MyDataSourceOptions, MyQuery } from 'types';

class TestDataSourceInstanceSettings implements DataSourceInstanceSettings<MyDataSourceOptions> {
    id: number;
    uid: string;
    type: string;
    name: string;
    meta: any;
    readOnly: boolean;
    jsonData: MyDataSourceOptions;
    access: 'direct' | 'proxy';

    constructor() {
        this.id = 1;
        this.uid = "";
        this.type = "";
        this.name = "";
        this.meta = null;
        this.readOnly = false;
        this.jsonData = { baseUrl: "http://localhost:8000"};
        this.access = "direct";
    }
};

describe('sum module', () => {
  test('query returns object of type SystemState', () => {
    let instanceSettings = new TestDataSourceInstanceSettings();
    let options = new DataQueryRequest
    let ds: DataSource = new DataSource(instanceSettings);
    expect(ds.query()).toBe();
  });
});