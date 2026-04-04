import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger, setLogLevel } from "../logger.js";
import { closeDb, initDb } from "./client.js";
import { conf, loadConfigFile } from "../ott-config.js";

const log = getLogger("db/migrate");

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

const DRIZZLE_TABLE = "__drizzle_migrations";

function getMigrationsDir(dialect: "postgres" | "sqlite") {
	const here = path.dirname(fileURLToPath(import.meta.url));
	return path.join(here, "migrations", dialect);
}

async function hasTable(tableName: string, dialect: "postgres" | "sqlite", connection: unknown) {
	if (dialect === "postgres") {
		const result = await (
			connection as {
				query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>;
			}
		).query(
			"SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1",
			["public", tableName]
		);
		return result.rowCount > 0;
	}

	const row = (connection as { prepare: (sql: string) => { get: (name: string) => unknown } })
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
		.get(tableName);
	return !!row;
}

async function ensureDrizzleTable(dialect: "postgres" | "sqlite", connection: unknown) {
	if (dialect === "postgres") {
		await (connection as { query: (sql: string) => Promise<unknown> }).query(`
			CREATE TABLE IF NOT EXISTS "${DRIZZLE_TABLE}" (
				name TEXT PRIMARY KEY,
				run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		return;
	}

	(connection as { exec: (sql: string) => void }).exec(`
		CREATE TABLE IF NOT EXISTS "${DRIZZLE_TABLE}" (
			name TEXT PRIMARY KEY,
			run_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
}

async function getAppliedMigrations(dialect: "postgres" | "sqlite", connection: unknown) {
	if (!(await hasTable(DRIZZLE_TABLE, dialect, connection))) {
		return [] as string[];
	}

	if (dialect === "postgres") {
		const result = await (
			connection as { query: (sql: string) => Promise<{ rows: Array<{ name: string }> }> }
		).query(`SELECT name FROM "${DRIZZLE_TABLE}" ORDER BY name ASC`);
		return result.rows.map(row => row.name);
	}

	const rows = (
		connection as { prepare: (sql: string) => { all: () => Array<{ name: string }> } }
	)
		.prepare(`SELECT name FROM "${DRIZZLE_TABLE}" ORDER BY name ASC`)
		.all();
	return rows.map(row => row.name);
}

async function getSequelizeMetaEntries(dialect: "postgres" | "sqlite", connection: unknown) {
	if (!(await hasTable("SequelizeMeta", dialect, connection))) {
		return [] as string[];
	}

	if (dialect === "postgres") {
		const result = await (
			connection as { query: (sql: string) => Promise<{ rows: Array<{ name: string }> }> }
		).query('SELECT name FROM "SequelizeMeta" ORDER BY name ASC');
		return result.rows.map(row => row.name);
	}

	const rows = (
		connection as { prepare: (sql: string) => { all: () => Array<{ name: string }> } }
	)
		.prepare('SELECT name FROM "SequelizeMeta" ORDER BY name ASC')
		.all();
	return rows.map(row => row.name);
}

async function recordMigration(name: string, dialect: "postgres" | "sqlite", connection: unknown) {
	if (dialect === "postgres") {
		await (connection as { query: (sql: string, params: unknown[]) => Promise<unknown> }).query(
			`INSERT INTO "${DRIZZLE_TABLE}" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
			[name]
		);
		return;
	}

	(connection as { prepare: (sql: string) => { run: (name: string) => void } })
		.prepare(`INSERT OR IGNORE INTO "${DRIZZLE_TABLE}" (name) VALUES (?)`)
		.run(name);
}

async function markLegacyDatabaseAsAdopted(
	files: string[],
	dialect: "postgres" | "sqlite",
	connection: unknown
) {
	const legacyEntries = await getSequelizeMetaEntries(dialect, connection);
	if (legacyEntries.length === 0) {
		return;
	}

	const missingEntries = LEGACY_SEQUELIZE_MIGRATIONS.filter(
		name => !legacyEntries.includes(name)
	);
	if (missingEntries.length > 0) {
		throw new Error(
			`Found SequelizeMeta with incomplete history. Run the legacy Sequelize migrations first or manually reconcile these missing entries: ${missingEntries.join(
				", "
			)}`
		);
	}

	log.info(
		"Existing Sequelize migration history detected, adopting current schema into Drizzle tracking"
	);
	for (const file of files) {
		await recordMigration(file, dialect, connection);
	}
}

async function runMigrationSql(
	fileName: string,
	sqlText: string,
	dialect: "postgres" | "sqlite",
	connection: unknown
) {
	log.info(`Running migration ${fileName}`);
	if (dialect === "postgres") {
		await (connection as { query: (sql: string) => Promise<unknown> }).query(sqlText);
	} else {
		(connection as { exec: (sql: string) => void }).exec(sqlText);
	}
	await recordMigration(fileName, dialect, connection);
}

export async function migrate() {
	loadConfigFile();
	setLogLevel(conf.get("log.level"));

	const context = initDb();
	const dialect = context.dialect;
	const connection = dialect === "postgres" ? context.pool : context.sqlite;

	await ensureDrizzleTable(dialect, connection);

	const migrationDir = getMigrationsDir(dialect);
	const files = fs
		.readdirSync(migrationDir)
		.filter(file => file.endsWith(".sql"))
		.sort();
	if (files.length === 0) {
		throw new Error(`No SQL migrations found in ${migrationDir}`);
	}

	let applied = await getAppliedMigrations(dialect, connection);
	if (applied.length === 0) {
		await markLegacyDatabaseAsAdopted(files, dialect, connection);
		applied = await getAppliedMigrations(dialect, connection);
	}

	for (const file of files) {
		if (applied.includes(file)) {
			continue;
		}
		const sqlPath = path.join(migrationDir, file);
		const sqlText = fs.readFileSync(sqlPath, "utf8");
		await runMigrationSql(file, sqlText, dialect, connection);
	}
	log.info("Database migrations complete");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	migrate()
		.catch(err => {
			log.error(`Migration failed: ${err instanceof Error ? err.stack ?? err.message : err}`);
			process.exitCode = 1;
		})
		.finally(async () => {
			await closeDb();
		});
}
