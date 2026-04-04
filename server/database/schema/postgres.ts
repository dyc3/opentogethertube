import { relations } from "drizzle-orm";
import {
	boolean,
	customType,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { ALL_SKIP_CATEGORIES } from "ott-common/constants.js";
import { BehaviorOption, QueueMode, Visibility } from "ott-common/models/types.js";
import type { CachedVideoRow, RoomPermissions, RoomRow, UserRow } from "./types.js";

const byteaBuffer = customType<{ data: Buffer | null; driverData: Buffer | null }>({
	dataType() {
		return "bytea";
	},
});

export const users = pgTable("Users", {
	id: serial("id").primaryKey(),
	username: varchar("username", { length: 255 }).notNull().unique(),
	email: varchar("email", { length: 255 }),
	salt: byteaBuffer("salt"),
	hash: byteaBuffer("hash"),
	discordId: varchar("discordId", { length: 255 }),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
	updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const rooms = pgTable("Rooms", {
	"id": serial("id").primaryKey(),
	"name": varchar("name", { length: 255 }).notNull().unique(),
	"title": varchar("title", { length: 255 }).notNull().default("Room"),
	"description": text("description").notNull().default(""),
	"visibility": varchar("visibility", { length: 255 }).notNull().default(Visibility.Public),
	"queueMode": varchar("queueMode", { length: 255 }).notNull().default(QueueMode.Manual),
	"ownerId": integer("ownerId"),
	"permissions": jsonb("permissions").$type<RoomPermissions | null>(),
	"role-admin": jsonb("role-admin").$type<number[] | null>(),
	"role-mod": jsonb("role-mod").$type<number[] | null>(),
	"role-trusted": jsonb("role-trusted").$type<number[] | null>(),
	"autoSkipSegmentCategories": jsonb("autoSkipSegmentCategories")
		.$type<RoomRow["autoSkipSegmentCategories"]>()
		.notNull()
		.default(ALL_SKIP_CATEGORIES),
	"prevQueue": jsonb("prevQueue").$type<RoomRow["prevQueue"]>(),
	"restoreQueueBehavior": integer("restoreQueueBehavior")
		.notNull()
		.default(BehaviorOption.Prompt),
	"enableVoteSkip": boolean("enableVoteSkip").notNull().default(false),
	"createdAt": timestamp("createdAt", { withTimezone: true, mode: "date" })
		.notNull()
		.defaultNow(),
	"updatedAt": timestamp("updatedAt", { withTimezone: true, mode: "date" })
		.notNull()
		.defaultNow(),
});

export const cachedVideos = pgTable(
	"CachedVideos",
	{
		id: serial("id").primaryKey(),
		service: varchar("service", { length: 255 }).notNull(),
		serviceId: varchar("serviceId", { length: 255 }).notNull(),
		title: varchar("title", { length: 255 }),
		description: text("description"),
		thumbnail: varchar("thumbnail", { length: 255 }),
		length: integer("length"),
		mime: varchar("mime", { length: 255 }),
		createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
			.notNull()
			.defaultNow(),
	},
	table => ({
		serviceServiceIdIdx: uniqueIndex("cachedvideo_service_serviceId").on(
			table.service,
			table.serviceId
		),
	})
);

export const roomsRelations = relations(rooms, ({ one }) => ({
	owner: one(users, {
		fields: [rooms.ownerId],
		references: [users.id],
	}),
}));

export const usersRelations = relations(users, ({ many }) => ({
	ownedRooms: many(rooms),
}));

export const schema = {
	users,
	rooms,
	cachedVideos,
	roomsRelations,
	usersRelations,
};

export type PostgresUserRow = typeof users.$inferSelect & UserRow;
export type PostgresRoomRow = typeof rooms.$inferSelect & RoomRow;
export type PostgresCachedVideoRow = typeof cachedVideos.$inferSelect & CachedVideoRow;
