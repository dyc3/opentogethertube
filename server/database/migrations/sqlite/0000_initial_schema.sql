CREATE TABLE `CachedVideos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`service` text NOT NULL,
	`serviceId` text NOT NULL,
	`title` text,
	`description` text,
	`thumbnail` text,
	`length` integer,
	`mime` text,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cachedvideo_service_serviceId` ON `CachedVideos` (`service`,`serviceId`);--> statement-breakpoint
CREATE TABLE `Rooms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT 'Room' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`queueMode` text DEFAULT 'manual' NOT NULL,
	`ownerId` integer,
	`permissions` text,
	`role-admin` text,
	`role-mod` text,
	`role-trusted` text,
	`autoSkipSegmentCategories` text DEFAULT '["sponsor","intro","outro","interaction","selfpromo","music_offtopic","preview"]' NOT NULL,
	`prevQueue` text,
	`restoreQueueBehavior` integer DEFAULT 1 NOT NULL,
	`enableVoteSkip` integer DEFAULT false NOT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Rooms_name_unique` ON `Rooms` (`name`);--> statement-breakpoint
CREATE TABLE `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`salt` blob,
	`hash` blob,
	`discordId` text,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_username_unique` ON `Users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `Users_email_unique` ON `Users` (`email`);