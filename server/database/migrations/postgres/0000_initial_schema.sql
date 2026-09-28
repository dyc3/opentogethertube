CREATE TABLE "CachedVideos" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(255) NOT NULL,
	"serviceId" varchar(255) NOT NULL,
	"title" varchar(255),
	"description" text,
	"thumbnail" varchar(255),
	"length" integer,
	"mime" varchar(255),
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "unique_service_serviceId" UNIQUE("service","serviceId")
);
--> statement-breakpoint
CREATE TABLE "Rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255) DEFAULT 'Room' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"visibility" varchar(255) DEFAULT 'public' NOT NULL,
	"queueMode" varchar(255) DEFAULT 'manual' NOT NULL,
	"ownerId" integer,
	"permissions" jsonb,
	"role-admin" jsonb,
	"role-mod" jsonb,
	"role-trusted" jsonb,
	"autoSkipSegmentCategories" jsonb DEFAULT '["sponsor","intro","outro","interaction","selfpromo","music_offtopic","preview"]'::jsonb NOT NULL,
	"prevQueue" jsonb,
	"restoreQueueBehavior" integer DEFAULT 1 NOT NULL,
	"enableVoteSkip" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "Rooms_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "Users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255),
	"salt" "bytea",
	"hash" "bytea",
	"discordId" varchar(255),
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "Users_username_key" UNIQUE("username"),
	CONSTRAINT "Users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cachedvideo_service_serviceId" ON "CachedVideos" USING btree ("service","serviceId");