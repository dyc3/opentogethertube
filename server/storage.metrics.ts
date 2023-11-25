import { Sequelize } from "sequelize";
import { QueryTypes } from "sequelize";
import { Counter, Gauge } from "prom-client";
import { getLogger } from "./logger";

const log = getLogger("storage");

/** Source: https://stackoverflow.com/questions/2596670/how-do-you-find-the-row-count-for-all-your-tables-in-postgres */
const POSTGRES_SQL_COLLECT_ALL_TABLE_ROWS_SLOW_ACCURATE = `WITH tbl AS
(SELECT table_schema,
		TABLE_NAME
 FROM information_schema.tables
 WHERE TABLE_NAME not like 'pg_%'
   AND table_schema in ('public'))
SELECT table_schema,
	 TABLE_NAME,
	 (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, TABLE_NAME), FALSE, TRUE, '')))[1]::text::int AS rows_n
FROM tbl
ORDER BY rows_n DESC;`;

const POSTGRES_SQL_COLLECT_ALL_TABLE_ROWS_FAST_ESTIMATE = `SELECT schemaname AS table_schema, relname AS table_name, n_live_tup::text::int AS rows_n
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;`;

export function setupPostgresMetricsCollection(sequelize: Sequelize) {
	const guagePostgresRowCount = new Gauge({
		name: "postgres_db_row_count",
		help: "Number of rows in a table in the database",
		labelNames: ["table"],
		async collect() {
			const timeStart = performance.now();
			interface ResultRow {
				table_schema: string;
				table_name: string;
				rows_n: number;
			}

			try {
				const result: ResultRow[] = await sequelize.query(
					POSTGRES_SQL_COLLECT_ALL_TABLE_ROWS_FAST_ESTIMATE,
					{
						type: QueryTypes.SELECT,
					}
				);
				log.debug(`result from query: ${JSON.stringify(result)}`);
				for (const row of result) {
					this.labels({ table: row.table_name }).set(row.rows_n);
				}
			} catch (e) {
				log.error("Failed to collect postgres db row count", e);
			}
			const timeEnd = performance.now();
			log.debug(`collecting postgres db row count took ${timeEnd - timeStart}ms`);
		},
	});

	const guagePostgresTableOps = new Gauge({
		name: "postgres_table_ops",
		help: "Number of table operations in the database",
		labelNames: ["table", "operation"],
		async collect() {
			const timeStart = performance.now();
			interface ResultRow {
				relname: string;
				seq_scan: string;
				seq_tup_read: string;
				idx_scan: string;
				idx_tup_fetch: string;
				n_tup_ins: string;
				n_tup_upd: string;
				n_tup_del: string;
			}

			const tableOps = [
				"seq_scan",
				"seq_tup_read",
				"idx_scan",
				"idx_tup_fetch",
				"n_tup_ins",
				"n_tup_upd",
				"n_tup_del",
			];

			try {
				const result: ResultRow[] = await sequelize.query(
					`SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables`,
					{
						type: QueryTypes.SELECT,
					}
				);
				log.debug(`result from query: ${JSON.stringify(result)}`);
				for (const row of result) {
					for (const op of tableOps) {
						this.labels({ table: row.relname, operation: op }).set(parseInt(row[op]));
					}
				}
			} catch (e) {
				log.error("Failed to collect postgres table stats", e);
			}
			const timeEnd = performance.now();
			log.debug(`collecting postgres table stats took ${timeEnd - timeStart}ms`);
		},
	});
}
