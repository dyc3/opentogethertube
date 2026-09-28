import path from "node:path";
import { fileURLToPath } from "node:url";
import { type SQL, sql } from "drizzle-orm";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { getLogger, setLogLevel } from "../logger.js";
import { conf, loadConfigFile } from "../ott-config.js";
import { closeDb, type DbContext, initDb } from "./client.js";

const log = getLogger("db/migrate");

/**
 * Every migration from before the switch to drizzle. A database that has applied all of these
 * already matches the drizzle baseline migration (0000).
 */
const LEGACY_SEQUELIZE_MIGRATIONS = [
	"20190830172621-create-room.js",
	"20190921194802-create-cached-video.js",
	"20191210180250-add-visibility-to-rooms.js",
	"20200301024743-disallow-null-video-cache.js",
	"20200322184635-add-mime-to-video.js",
	"20200405160435-create-user.js",
	"20200415024537-add-owner-id-to-rooms.js",
	"20200620171123-add-discordId-to-user.js",
	"20210121172521-add-permissions-to-rooms.js",
	"20210508182154-add-queue-mode-to-rooms.js",
	"20211012010106-add-auto-skip-to-rooms.js",
	"20230615122836-to-json-columns.js",
	"20230615125602-null-owner-id.js",
	"20230628162834-cachedvideo-unique-constraint.js",
	"20230628203138-add-prev-queue-to-room.js",
	"20230630124020-add-restore-queue-behavior.js",
	"20230630214059-add-enable-vote-skip.js",
	"20240121172024-add-auto-skip-fields-to-rooms.js",
];

export function getMigrationsFolder(dialect: DbContext["dialect"]): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	return path.join(here, "migrations", dialect);
}

async function query<T>(context: DbContext, statement: SQL): Promise<T[]> {
	if (context.dialect === "postgres") {
		const result = await context.db.execute(statement);
		return result.rows as T[];
	}
	return context.db.all<T>(statement);
}

async function execute(context: DbContext, statement: SQL): Promise<void> {
	if (context.dialect === "postgres") {
		await context.db.execute(statement);
	} else {
		context.db.run(statement);
	}
}

/** `pgSchema` defaults to the connection's current schema and is ignored for sqlite. */
async function hasTable(context: DbContext, name: string, pgSchema?: string): Promise<boolean> {
	const rows =
		context.dialect === "postgres"
			? await query(
					context,
					sql`SELECT 1 FROM information_schema.tables WHERE table_schema = ${pgSchema ?? sql`current_schema()`} AND table_name = ${name}`,
				)
			: await query(
					context,
					sql`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${name}`,
				);
	return rows.length > 0;
}

/**
 * Databases created by the old Sequelize migrations already have the schema that the baseline
 * migration creates. For those, record the baseline as applied in drizzle's migration table so
 * that drizzle's migrator skips it and only runs the migrations that come after it.
 */
async function adoptSequelizeDatabase(context: DbContext, migrationsFolder: string) {
	if (!(await hasTable(context, "SequelizeMeta"))) {
		return;
	}

	// These match the table that drizzle's migrator creates for itself.
	const migrationsTable =
		context.dialect === "postgres"
			? '"drizzle"."__drizzle_migrations"'
			: '"__drizzle_migrations"';
	if (await hasTable(context, "__drizzle_migrations", "drizzle")) {
		const applied = await query(context, sql.raw(`SELECT 1 FROM ${migrationsTable} LIMIT 1`));
		if (applied.length > 0) {
			return;
		}
	}

	const legacyEntries = (
		await query<{ name: string }>(context, sql`SELECT name FROM "SequelizeMeta"`)
	).map(row => row.name);
	const missing = LEGACY_SEQUELIZE_MIGRATIONS.filter(name => !legacyEntries.includes(name));
	if (missing.length > 0) {
		throw new Error(
			`Found SequelizeMeta with incomplete history. Run the legacy Sequelize migrations first or manually reconcile these missing entries: ${missing.join(
				", ",
			)}`,
		);
	}

	log.info(
		"Existing Sequelize migration history detected, adopting current schema into Drizzle tracking",
	);
	const [baseline] = readMigrationFiles({ migrationsFolder });
	if (context.dialect === "postgres") {
		await execute(context, sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
		await execute(
			context,
			sql.raw(
				`CREATE TABLE IF NOT EXISTS ${migrationsTable} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
			),
		);
	} else {
		await execute(
			context,
			sql.raw(
				`CREATE TABLE IF NOT EXISTS ${migrationsTable} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
			),
		);
	}
	await execute(
		context,
		sql`INSERT INTO ${sql.raw(migrationsTable)} ("hash", "created_at") VALUES (${baseline.hash}, ${baseline.folderMillis})`,
	);
}

export async function runMigrations(context: DbContext) {
	const migrationsFolder = getMigrationsFolder(context.dialect);
	await adoptSequelizeDatabase(context, migrationsFolder);
	if (context.dialect === "postgres") {
		await migratePostgres(context.db, { migrationsFolder });
	} else {
		migrateSqlite(context.db, { migrationsFolder });
	}
}

export async function migrate() {
	loadConfigFile();
	setLogLevel(conf.get("log.level"));
	await runMigrations(initDb());
	log.info("Database migrations complete");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		await migrate();
	} catch (err) {
		log.error(`Migration failed: ${err instanceof Error ? (err.stack ?? err.message) : err}`);
		process.exitCode = 1;
	} finally {
		await closeDb();
	}
}
