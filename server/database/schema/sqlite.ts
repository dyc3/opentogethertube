import { relations } from "drizzle-orm";
import { customType, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ALL_SKIP_CATEGORIES } from "ott-common/constants.js";
import { BehaviorOption, QueueMode, Visibility } from "ott-common/models/types.js";
import type { CachedVideoRow, RoomPermissions, RoomRow, UserRow } from "./types.js";

const jsonText = <T>(name: string) =>
	customType<{ data: T; driverData: string }>({
		dataType() {
			return "text";
		},
		toDriver(value) {
			return JSON.stringify(value);
		},
		fromDriver(value) {
			return JSON.parse(value);
		},
	})(name);

const blobBuffer = customType<{ data: Buffer | null; driverData: Buffer | Uint8Array | null }>({
	dataType() {
		return "blob";
	},
	toDriver(value) {
		return value;
	},
	fromDriver(value) {
		if (value === null) {
			return null;
		}
		return Buffer.isBuffer(value) ? value : Buffer.from(value);
	},
});

const dateText = customType<{ data: Date; driverData: string }>({
	dataType() {
		return "datetime";
	},
	toDriver(value) {
		return value.toISOString();
	},
	fromDriver(value) {
		return new Date(value);
	},
});

export const users = sqliteTable("Users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	username: text("username").notNull().unique(),
	email: text("email"),
	salt: blobBuffer("salt"),
	hash: blobBuffer("hash"),
	discordId: text("discordId"),
	createdAt: dateText("createdAt").notNull(),
	updatedAt: dateText("updatedAt").notNull(),
});

export const rooms = sqliteTable("Rooms", {
	"id": integer("id").primaryKey({ autoIncrement: true }),
	"name": text("name").notNull().unique(),
	"title": text("title").notNull().default("Room"),
	"description": text("description").notNull().default(""),
	"visibility": text("visibility").notNull().default(Visibility.Public),
	"queueMode": text("queueMode").notNull().default(QueueMode.Manual),
	"ownerId": integer("ownerId"),
	"permissions": jsonText<RoomPermissions | null>("permissions"),
	"role-admin": jsonText<number[] | null>("role-admin"),
	"role-mod": jsonText<number[] | null>("role-mod"),
	"role-trusted": jsonText<number[] | null>("role-trusted"),
	"autoSkipSegmentCategories": jsonText<RoomRow["autoSkipSegmentCategories"]>(
		"autoSkipSegmentCategories"
	)
		.notNull()
		.default(ALL_SKIP_CATEGORIES),
	"prevQueue": jsonText<RoomRow["prevQueue"]>("prevQueue"),
	"restoreQueueBehavior": integer("restoreQueueBehavior")
		.notNull()
		.default(BehaviorOption.Prompt),
	"enableVoteSkip": integer("enableVoteSkip", { mode: "boolean" }).notNull().default(false),
	"createdAt": dateText("createdAt").notNull(),
	"updatedAt": dateText("updatedAt").notNull(),
});

export const cachedVideos = sqliteTable(
	"CachedVideos",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		service: text("service").notNull(),
		serviceId: text("serviceId").notNull(),
		title: text("title"),
		description: text("description"),
		thumbnail: text("thumbnail"),
		length: integer("length"),
		mime: text("mime"),
		createdAt: dateText("createdAt").notNull(),
		updatedAt: dateText("updatedAt").notNull(),
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

export type SqliteUserRow = typeof users.$inferSelect & UserRow;
export type SqliteRoomRow = typeof rooms.$inferSelect & RoomRow;
export type SqliteCachedVideoRow = typeof cachedVideos.$inferSelect & CachedVideoRow;
