import { Room as DbRoomModel, User as UserModel } from "../models";
import { Room as DbRoom, RoomAttributes } from "../models/room";
import { Role, RoomOptions } from "../../common/models/types";
import { getLogger } from "../logger.js";
import Sequelize from "sequelize";
import permissions from "../../common/permissions";
import type { RoomStatePersistable } from "../room";

const log = getLogger("storage/room");

function buildFindRoomWhere(roomName: string) {
	return Sequelize.and(
		Sequelize.where(
			Sequelize.fn("lower", Sequelize.col("name")),
			Sequelize.fn("lower", roomName)
		)
	);
}

export async function getRoomByName(roomName: string): Promise<RoomOptions | null> {
	try {
		const dbroom = await DbRoomModel.findOne({
			where: buildFindRoomWhere(roomName),
			include: { model: UserModel, as: "owner" },
		});
		if (!dbroom) {
			log.debug(`Room ${roomName} does not exist in db.`);
			return null;
		}
		return dbToRoomArgs(dbroom);
	} catch (err) {
		log.error(`Failed to get room by name: ${err} ${err.stack}`);
	}
	return null;
}

export async function isRoomNameTaken(roomName: string): Promise<boolean> {
	try {
		const room = await DbRoomModel.findOne({
			where: buildFindRoomWhere(roomName),
		});
		return !!room;
	} catch (err) {
		log.error(`${err} ${err.stack}`);
		throw err;
	}
}

/**
 * Create a room in the database, if it doesn't already exist
 * @returns boolean indicating whether the room was saved successfully
 */
export async function saveRoom(room: RoomStatePersistable): Promise<boolean> {
	const options = roomToDb(room);
	// HACK: search for the room to see if it exists
	if (await isRoomNameTaken(options.name)) {
		return false;
	}
	try {
		const room: DbRoom = await DbRoomModel.create(options);
		log.info(`Saved room ${room.name} to db: id ${room.dataValues.id}`);
		return true;
	} catch (err) {
		log.error(`Failed to save room ${room.name} to storage: ${err}`);
		return false;
	}
}

/**
 *Create a room in the database, if it doesn't already exist
 * @returns boolean indicating whether the room was saved successfully
 */
export async function updateRoom(room: RoomStatePersistable): Promise<boolean> {
	if (!room.name) {
		throw new Error(`Cannot update room with no name`);
	}
	try {
		// TODO: optimize this to just do an update query, instead of a find and then update
		const dbroom = await DbRoomModel.findOne({
			where: buildFindRoomWhere(room.name),
		});
		if (!dbroom) {
			return false;
		}
		const options = roomToDb(room);
		log.debug(`updating room ${room.name} in database ${JSON.stringify(options)}`);
		await dbroom.update(options);
		return true;
	} catch (error) {
		log.error(`Failed to update room ${room.name} in storage: ${error}`);
		return false;
	}
}

function dbToRoomArgs(db: DbRoom): RoomOptions {
	const room = {
		name: db.name,
		title: db.title,
		description: db.description,
		isTemporary: false,
		visibility: db.visibility,
		queueMode: db.queueMode,
		owner: db.owner,
		grants: new permissions.Grants(db.permissions),
		userRoles: new Map<Role, Set<number>>(),
		autoSkipSegments: db.autoSkipSegments,
	};
	for (let i = Role.TrustedUser; i <= 4; i++) {
		room.userRoles.set(i, new Set(db[`role-${permissions.ROLE_NAMES[i]}`]));
	}
	return room;
}

/**
 * Converts a room into an object that can be stored in the database
 */
function roomToDb(room: RoomStatePersistable): Omit<RoomAttributes, "id"> {
	const db: Omit<RoomAttributes, "id"> = {
		"name": room.name,
		"title": room.title,
		"description": room.description,
		"visibility": room.visibility,
		"queueMode": room.queueMode,
		"autoSkipSegments": room.autoSkipSegments,
		"permissions": room.grants.toJSON(),
		"ownerId": null,
		"role-trusted": [],
		"role-mod": [],
		"role-admin": [],
	};
	if (room.owner) {
		db.ownerId = room.owner.id;
	}
	if (room.userRoles) {
		for (let i = Role.TrustedUser; i <= 4; i++) {
			db[`role-${permissions.ROLE_NAMES[i]}`] = Array.from(room.userRoles.get(i)?.values() ?? []);
		}
	}
	return db;
}
