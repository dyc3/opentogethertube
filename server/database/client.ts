import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool as PgPool } from "pg";
import pg from "pg";
import { getLogger } from "../logger.js";
import { conf } from "../ott-config.js";
import * as postgresSchema from "./schema/postgres.js";
import * as sqliteSchema from "./schema/sqlite.js";

const log = getLogger("db");
const { Pool } = pg;

export type DbContext =
	| {
			dialect: "postgres";
			db: NodePgDatabase<typeof postgresSchema.schema>;
			pool: PgPool;
			schema: typeof postgresSchema.schema;
	  }
	| {
			dialect: "sqlite";
			db: BetterSQLite3Database<typeof sqliteSchema.schema>;
			sqlite: Database.Database;
			schema: typeof sqliteSchema.schema;
	  };

let dbContext: DbContext | null = null;

function ensureSqliteDir() {
	const dbDir = path.resolve(process.cwd(), "db");
	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true });
	}
}

export function initDb(): DbContext {
	if (dbContext) {
		return dbContext;
	}

	const dbmode = conf.get("db.mode");
	const dburl: string | null = conf.get("db.url");

	if (dbmode === "postgres") {
		const pool = dburl
			? new Pool({
					connectionString: dburl,
					ssl: conf.get("heroku") ? { rejectUnauthorized: false } : undefined,
			  })
			: new Pool({
					host: conf.get("db.host"),
					port: conf.get("db.port"),
					database: conf.get("db.name"),
					user: conf.get("db.user"),
					password: conf.get("db.password") ?? undefined,
			  });

		const db = drizzlePg(pool, { schema: postgresSchema.schema });
		dbContext = { dialect: "postgres", db, pool, schema: postgresSchema.schema };
		log.info("Database client initialized for postgres");
		return dbContext;
	}

	if (dbmode === "sqlite") {
		ensureSqliteDir();
		const sqliteFile = path.resolve(process.cwd(), `db/${conf.get("env")}.sqlite`);
		const sqlite = new Database(sqliteFile);
		sqlite.pragma("journal_mode = WAL");
		sqlite.pragma("foreign_keys = ON");
		const db = drizzleSqlite(sqlite, { schema: sqliteSchema.schema });
		dbContext = { dialect: "sqlite", db, sqlite, schema: sqliteSchema.schema };
		log.info(`Database client initialized for sqlite: ${sqliteFile}`);
		return dbContext;
	}

	throw new Error(`Unknown db mode: ${dbmode}`);
}

export function getDb(): DbContext {
	return dbContext ?? initDb();
}

export async function closeDb() {
	if (!dbContext) {
		return;
	}

	if (dbContext.dialect === "postgres") {
		await dbContext.pool.end();
	} else {
		dbContext.sqlite.close();
	}

	dbContext = null;
}
