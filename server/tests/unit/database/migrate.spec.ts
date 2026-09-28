import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DbContext } from "../../../database/client.js";
import { runMigrations } from "../../../database/migrate.js";
import * as sqliteSchema from "../../../database/schema/sqlite.js";

// The schema that the last Sequelize migration left behind in sqlite.
const LEGACY_SQLITE_SCHEMA = `
CREATE TABLE \`SequelizeMeta\` (\`name\` VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY);
CREATE TABLE \`Users\` (\`id\` INTEGER PRIMARY KEY, \`username\` VARCHAR(255) NOT NULL UNIQUE, \`email\` VARCHAR(255) UNIQUE, \`salt\` BLOB, \`hash\` BLOB, \`createdAt\` DATETIME NOT NULL, \`updatedAt\` DATETIME NOT NULL, \`discordId\` VARCHAR(255) DEFAULT NULL);
CREATE TABLE "CachedVideos" (\`id\` INTEGER PRIMARY KEY, \`service\` VARCHAR(255) NOT NULL, \`serviceId\` VARCHAR(255) NOT NULL, \`title\` VARCHAR(255), \`description\` TEXT, \`thumbnail\` VARCHAR(255), \`length\` INTEGER, \`createdAt\` DATETIME NOT NULL, \`updatedAt\` DATETIME NOT NULL, \`mime\` VARCHAR(255) DEFAULT NULL, CONSTRAINT \`unique_service_serviceId\` UNIQUE (\`service\`, \`serviceId\`));
CREATE UNIQUE INDEX \`cachedvideo_service_serviceId\` ON \`CachedVideos\` (\`service\`, \`serviceId\`);
CREATE TABLE \`Rooms\` (\`id\` INTEGER PRIMARY KEY, \`name\` VARCHAR(255) NOT NULL UNIQUE, \`title\` VARCHAR(255) NOT NULL DEFAULT 'Room', \`description\` TEXT NOT NULL DEFAULT '', \`createdAt\` DATETIME NOT NULL, \`updatedAt\` DATETIME NOT NULL, \`visibility\` VARCHAR(255) NOT NULL DEFAULT 'public', \`ownerId\` INTEGER DEFAULT '-1', \`permissions\` JSONB, \`role-admin\` JSONB, \`role-mod\` JSONB, \`role-trusted\` JSONB, \`queueMode\` VARCHAR(255) NOT NULL DEFAULT 'manual', \`prevQueue\` JSONB, \`restoreQueueBehavior\` INTEGER NOT NULL DEFAULT '1', \`enableVoteSkip\` TINYINT(1) NOT NULL DEFAULT 0, \`autoSkipSegmentCategories\` JSONB NOT NULL DEFAULT '["sponsor","intro","outro","interaction","selfpromo","music_offtopic","preview"]');
`;

const LEGACY_MIGRATIONS = [
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

describe("runMigrations", () => {
	let sqlite: Database.Database;
	let db: BetterSQLite3Database<typeof sqliteSchema.schema>;
	let context: DbContext;

	beforeEach(() => {
		sqlite = new Database(":memory:");
		db = drizzle(sqlite, { schema: sqliteSchema.schema });
		context = { dialect: "sqlite", db, sqlite, schema: sqliteSchema.schema };
	});

	afterEach(() => {
		sqlite.close();
	});

	function appliedMigrations() {
		return sqlite.prepare("SELECT hash, created_at FROM __drizzle_migrations").all();
	}

	function seedLegacyDatabase(migrations: string[]) {
		sqlite.exec(LEGACY_SQLITE_SCHEMA);
		const insert = sqlite.prepare('INSERT INTO "SequelizeMeta" (name) VALUES (?)');
		for (const name of migrations) {
			insert.run(name);
		}
		sqlite
			.prepare(
				"INSERT INTO Rooms (name, createdAt, updatedAt) VALUES ('legacyroom', '2024-01-21 17:20:24.123 +00:00', '2024-01-21 17:20:24.123 +00:00')",
			)
			.run();
	}

	it("should create the schema in an empty database", async () => {
		await runMigrations(context);

		const tables = sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
			.all()
			.map(row => (row as { name: string }).name);
		expect(tables).toEqual(expect.arrayContaining(["CachedVideos", "Rooms", "Users"]));
		expect(appliedMigrations()).toHaveLength(1);
	});

	it("should do nothing when run a second time", async () => {
		await runMigrations(context);
		await runMigrations(context);

		expect(appliedMigrations()).toHaveLength(1);
	});

	it("should adopt a database created by the Sequelize migrations without changing it", async () => {
		seedLegacyDatabase(LEGACY_MIGRATIONS);

		await runMigrations(context);

		expect(appliedMigrations()).toHaveLength(1);
		const rooms = await db.query.rooms.findMany();
		expect(rooms.map(room => room.name)).toEqual(["legacyroom"]);
		expect(rooms[0].createdAt.toISOString()).toBe("2024-01-21T17:20:24.123Z");
	});

	it("should refuse to adopt a database with incomplete Sequelize history", async () => {
		seedLegacyDatabase(LEGACY_MIGRATIONS.slice(0, -1));

		await expect(runMigrations(context)).rejects.toThrow(
			"20240121172024-add-auto-skip-fields-to-rooms.js",
		);
		expect(
			sqlite
				.prepare("SELECT name FROM sqlite_master WHERE name = '__drizzle_migrations'")
				.all(),
		).toHaveLength(0);
	});
});
