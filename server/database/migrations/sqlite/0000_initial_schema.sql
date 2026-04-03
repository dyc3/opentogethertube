CREATE TABLE IF NOT EXISTS "Users" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
	"username" TEXT NOT NULL UNIQUE,
	"email" TEXT UNIQUE,
	"salt" BLOB,
	"hash" BLOB,
	"discordId" TEXT,
	"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Rooms" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL DEFAULT 'Room',
	"description" TEXT NOT NULL DEFAULT '',
	"visibility" TEXT NOT NULL DEFAULT 'public',
	"queueMode" TEXT NOT NULL DEFAULT 'manual',
	"ownerId" INTEGER,
	"permissions" TEXT,
	"role-admin" TEXT,
	"role-mod" TEXT,
	"role-trusted" TEXT,
	"autoSkipSegmentCategories" TEXT NOT NULL DEFAULT '["sponsor","intro","outro","interaction","selfpromo","music_offtopic","preview"]',
	"prevQueue" TEXT,
	"restoreQueueBehavior" INTEGER NOT NULL DEFAULT 1,
	"enableVoteSkip" INTEGER NOT NULL DEFAULT 0,
	"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CachedVideos" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
	"service" TEXT NOT NULL,
	"serviceId" TEXT NOT NULL,
	"title" TEXT,
	"description" TEXT,
	"thumbnail" TEXT,
	"length" INTEGER,
	"mime" TEXT,
	"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "cachedvideo_service_serviceId" ON "CachedVideos" ("service", "serviceId");
