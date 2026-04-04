CREATE TABLE IF NOT EXISTS "Users" (
	"id" SERIAL PRIMARY KEY,
	"username" VARCHAR(255) NOT NULL UNIQUE,
	"email" VARCHAR(255) UNIQUE,
	"salt" BYTEA,
	"hash" BYTEA,
	"discordId" VARCHAR(255),
	"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Rooms" (
	"id" SERIAL PRIMARY KEY,
	"name" VARCHAR(255) NOT NULL UNIQUE,
	"title" VARCHAR(255) NOT NULL DEFAULT 'Room',
	"description" TEXT NOT NULL DEFAULT '',
	"visibility" VARCHAR(255) NOT NULL DEFAULT 'public',
	"queueMode" VARCHAR(255) NOT NULL DEFAULT 'manual',
	"ownerId" INTEGER,
	"permissions" JSONB,
	"role-admin" JSONB,
	"role-mod" JSONB,
	"role-trusted" JSONB,
	"autoSkipSegmentCategories" JSONB NOT NULL DEFAULT '["sponsor","intro","outro","interaction","selfpromo","music_offtopic","preview"]'::jsonb,
	"prevQueue" JSONB,
	"restoreQueueBehavior" INTEGER NOT NULL DEFAULT 1,
	"enableVoteSkip" BOOLEAN NOT NULL DEFAULT FALSE,
	"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CachedVideos" (
	"id" SERIAL PRIMARY KEY,
	"service" VARCHAR(255) NOT NULL,
	"serviceId" VARCHAR(255) NOT NULL,
	"title" VARCHAR(255),
	"description" TEXT,
	"thumbnail" VARCHAR(255),
	"length" INTEGER,
	"mime" VARCHAR(255),
	"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "cachedvideo_service_serviceId" ON "CachedVideos" ("service", "serviceId");
