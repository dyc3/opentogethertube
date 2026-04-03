import { eq, sql } from "drizzle-orm";
import {
	Role,
	type QueueMode,
	type RoomOptions,
	type UserAccountAttributes,
	type Visibility,
} from "ott-common/models/types.js";
import { getLogger } from "../logger.js";
import permissions from "ott-common/permissions.js";
import type { RoomStatePersistable } from "../room.js";
import _ from "lodash";
import { getDb } from "../database/client.js";
import type { RoomRow } from "../database/schema/types.js";

const log = getLogger("storage/room");

type RoomSelectRow = Pick<
	RoomRow,
	| "name"
	| "title"
	| "description"
	| "permissions"
	| "role-admin"
	| "role-mod"
	| "role-trusted"
	| "autoSkipSegmentCategories"
	| "prevQueue"
	| "restoreQueueBehavior"
	| "enableVoteSkip"
> & {
	visibility: Visibility | string;
	queueMode: QueueMode | string;
	ownerUserId: number | null;
	ownerUsername: string | null;
	ownerEmail: string | null;
	ownerSalt: Buffer | null;
	ownerHash: Buffer | null;
	ownerDiscordId: string | null;
};

async function selectRoomByName(roomName: string): Promise<RoomSelectRow | undefined> {
	const context = getDb();

	if (context.dialect === "postgres") {
		const rows = await context.db
			.select({
				"name": context.schema.rooms.name,
				"title": context.schema.rooms.title,
				"description": context.schema.rooms.description,
				"visibility": context.schema.rooms.visibility,
				"queueMode": context.schema.rooms.queueMode,
				"permissions": context.schema.rooms.permissions,
				"role-admin": context.schema.rooms["role-admin"],
				"role-mod": context.schema.rooms["role-mod"],
				"role-trusted": context.schema.rooms["role-trusted"],
				"autoSkipSegmentCategories": context.schema.rooms.autoSkipSegmentCategories,
				"prevQueue": context.schema.rooms.prevQueue,
				"restoreQueueBehavior": context.schema.rooms.restoreQueueBehavior,
				"enableVoteSkip": context.schema.rooms.enableVoteSkip,
				"ownerUserId": context.schema.users.id,
				"ownerUsername": context.schema.users.username,
				"ownerEmail": context.schema.users.email,
				"ownerSalt": context.schema.users.salt,
				"ownerHash": context.schema.users.hash,
				"ownerDiscordId": context.schema.users.discordId,
			})
			.from(context.schema.rooms)
			.leftJoin(
				context.schema.users,
				eq(context.schema.rooms.ownerId, context.schema.users.id)
			)
			.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
			.limit(1);
		return rows[0];
	}

	const rows = await context.db
		.select({
			"name": context.schema.rooms.name,
			"title": context.schema.rooms.title,
			"description": context.schema.rooms.description,
			"visibility": context.schema.rooms.visibility,
			"queueMode": context.schema.rooms.queueMode,
			"permissions": context.schema.rooms.permissions,
			"role-admin": context.schema.rooms["role-admin"],
			"role-mod": context.schema.rooms["role-mod"],
			"role-trusted": context.schema.rooms["role-trusted"],
			"autoSkipSegmentCategories": context.schema.rooms.autoSkipSegmentCategories,
			"prevQueue": context.schema.rooms.prevQueue,
			"restoreQueueBehavior": context.schema.rooms.restoreQueueBehavior,
			"enableVoteSkip": context.schema.rooms.enableVoteSkip,
			"ownerUserId": context.schema.users.id,
			"ownerUsername": context.schema.users.username,
			"ownerEmail": context.schema.users.email,
			"ownerSalt": context.schema.users.salt,
			"ownerHash": context.schema.users.hash,
			"ownerDiscordId": context.schema.users.discordId,
		})
		.from(context.schema.rooms)
		.leftJoin(context.schema.users, eq(context.schema.rooms.ownerId, context.schema.users.id))
		.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
		.limit(1);
	return rows[0];
}

export async function getRoomByName(roomName: string): Promise<RoomOptions | null> {
	try {
		const dbroom = await selectRoomByName(roomName);
		if (!dbroom) {
			log.debug(`Room ${roomName} does not exist in db.`);
			return null;
		}
		return dbToRoomArgs(dbroom);
	} catch (err) {
		log.error(`Failed to get room by name: ${err} ${err instanceof Error ? err.stack : ""}`);
	}
	return null;
}

export async function isRoomNameTaken(roomName: string): Promise<boolean> {
	try {
		const context = getDb();

		const room =
			context.dialect === "postgres"
				? await context.db
						.select({ id: context.schema.rooms.id })
						.from(context.schema.rooms)
						.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
						.limit(1)
				: await context.db
						.select({ id: context.schema.rooms.id })
						.from(context.schema.rooms)
						.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
						.limit(1);

		return !!room[0];
	} catch (err) {
		log.error(`${err} ${err instanceof Error ? err.stack : ""}`);
		throw err;
	}
}

export async function saveRoom(room: RoomStatePersistable): Promise<boolean> {
	const options = roomToDb(room);
	if (await isRoomNameTaken(room.name)) {
		return false;
	}
	try {
		const context = getDb();
		const now = new Date();
		const inserted =
			context.dialect === "postgres"
				? await context.db
						.insert(context.schema.rooms)
						.values({
							...options,
							createdAt: now,
							updatedAt: now,
						})
						.returning({ id: context.schema.rooms.id })
				: await context.db
						.insert(context.schema.rooms)
						.values({
							...options,
							createdAt: now,
							updatedAt: now,
						})
						.returning({ id: context.schema.rooms.id });
		log.info(`Saved room ${room.name} to db: id ${inserted[0]?.id ?? "unknown"}`);
		return true;
	} catch (err) {
		log.error(`Failed to save room ${room.name} to storage: ${err}`);
		return false;
	}
}

export async function updateRoom(room: Partial<RoomStatePersistable>): Promise<boolean> {
	if (!room.name) {
		throw new Error(`Cannot update room with no name`);
	}
	try {
		const context = getDb();
		const options = roomToDbPartial(room);
		log.debug(`updating room ${room.name} in database ${JSON.stringify(options)}`);
		const result =
			context.dialect === "postgres"
				? await context.db
						.update(context.schema.rooms)
						.set({
							...options,
							updatedAt: new Date(),
						})
						.where(sql`lower(${context.schema.rooms.name}) = lower(${room.name})`)
						.returning({ id: context.schema.rooms.id })
				: await context.db
						.update(context.schema.rooms)
						.set({
							...options,
							updatedAt: new Date(),
						})
						.where(sql`lower(${context.schema.rooms.name}) = lower(${room.name})`)
						.returning({ id: context.schema.rooms.id });
		return result.length > 0;
	} catch (error) {
		log.error(`Failed to update room ${room.name} in storage: ${error}`);
		return false;
	}
}

export async function deleteRoom(roomName: string): Promise<boolean> {
	try {
		const context = getDb();
		const deleted =
			context.dialect === "postgres"
				? await context.db
						.delete(context.schema.rooms)
						.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
						.returning({ id: context.schema.rooms.id })
				: await context.db
						.delete(context.schema.rooms)
						.where(sql`lower(${context.schema.rooms.name}) = lower(${roomName})`)
						.returning({ id: context.schema.rooms.id });
		if (deleted.length === 0) {
			log.debug(`Room ${roomName} not found in db to delete.`);
		} else {
			log.info(`Deleted room ${roomName} from db: ${deleted.length} row(s)`);
		}
		return deleted.length > 0;
	} catch (err) {
		log.error(`Failed to delete room ${roomName} from storage: ${err}`);
		throw err;
	}
}

function dbToRoomArgs(db: RoomSelectRow): RoomOptions {
	const owner: UserAccountAttributes | null =
		db.ownerUserId === null
			? null
			: {
					id: db.ownerUserId,
					username: db.ownerUsername ?? "",
					email: db.ownerEmail,
					salt: db.ownerSalt,
					hash: db.ownerHash,
					discordId: db.ownerDiscordId,
			  };

	const room: RoomOptions = {
		name: db.name,
		title: db.title,
		description: db.description,
		isTemporary: false,
		visibility: db.visibility as Visibility,
		queueMode: db.queueMode as QueueMode,
		owner,
		grants: new permissions.Grants(db.permissions ?? undefined),
		userRoles: new Map<Role, Set<number>>(),
		autoSkipSegmentCategories: db.autoSkipSegmentCategories,
		prevQueue: db.prevQueue,
		restoreQueueBehavior: db.restoreQueueBehavior,
		enableVoteSkip: db.enableVoteSkip,
	};
	for (let i = Role.TrustedUser; i <= 4; i++) {
		room.userRoles.set(i, new Set(db[`role-${permissions.ROLE_NAMES[i]}`] ?? []));
	}
	return room;
}

export function roomToDb(
	room: RoomStatePersistable
): Omit<RoomRow, "id" | "createdAt" | "updatedAt"> {
	const grantsFiltered = _.cloneDeep(room.grants);
	grantsFiltered.deleteRole(Role.Administrator);
	grantsFiltered.deleteRole(Role.Owner);

	const db: Omit<RoomRow, "id" | "createdAt" | "updatedAt"> = {
		"name": room.name,
		"title": room.title,
		"description": room.description,
		"visibility": room.visibility,
		"queueMode": room.queueMode,
		"autoSkipSegmentCategories": room.autoSkipSegmentCategories,
		"permissions": grantsFiltered.toJSON(),
		"ownerId": null,
		"role-trusted": [],
		"role-mod": [],
		"role-admin": [],
		"prevQueue": room.prevQueue,
		"restoreQueueBehavior": room.restoreQueueBehavior,
		"enableVoteSkip": room.enableVoteSkip,
	};
	if (room.owner) {
		db.ownerId = room.owner.id;
	}
	if (room.userRoles) {
		for (let i = Role.TrustedUser; i <= 4; i++) {
			db[`role-${permissions.ROLE_NAMES[i]}`] = Array.from(
				room.userRoles.get(i)?.values() ?? []
			);
		}
	}
	return db;
}

export function roomToDbPartial(
	room: Partial<RoomStatePersistable>
): Partial<Omit<RoomRow, "id" | "name" | "createdAt" | "updatedAt">> {
	const db: Partial<Omit<RoomRow, "id" | "name" | "createdAt" | "updatedAt">> = _.pickBy(
		{
			title: room.title,
			description: room.description,
			visibility: room.visibility,
			queueMode: room.queueMode,
			autoSkipSegmentCategories: room.autoSkipSegmentCategories,
			restoreQueueBehavior: room.restoreQueueBehavior,
			enableVoteSkip: room.enableVoteSkip,
		},
		v => !!v
	);
	if (room.prevQueue || room.prevQueue === null) {
		db.prevQueue = room.prevQueue;
	}
	if (room.grants) {
		const grantsFiltered = _.cloneDeep(room.grants);
		grantsFiltered.deleteRole(Role.Administrator);
		grantsFiltered.deleteRole(Role.Owner);
		db.permissions = grantsFiltered.toJSON();
	}
	if (room.owner) {
		db.ownerId = room.owner.id;
	}
	if (room.userRoles) {
		for (let i = Role.TrustedUser; i <= 4; i++) {
			db[`role-${permissions.ROLE_NAMES[i]}`] = Array.from(
				room.userRoles.get(i)?.values() ?? []
			);
		}
	}
	return db;
}
