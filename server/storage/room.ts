const { Room: DbRoomModel, User: UserModel } = require("../models");
import { Room as DbRoom } from "../models/room";
import { Role, RoomOptions } from "../../common/models/types";
import { getLogger } from "../logger.js";
import Sequelize from "sequelize";
import permissions from "../../common/permissions";

const log = getLogger("storage");

export async function getRoomByName(roomName: string): Promise<RoomOptions | null> {
	try {
		const dbroom = await DbRoomModel.findOne({
			where: Sequelize.and(
				Sequelize.where(
					Sequelize.fn("lower", Sequelize.col("name")),
					Sequelize.fn("lower", roomName)
				)
			),
			include: { model: UserModel, as: "owner" },
		});
		if (!dbroom) {
			log.debug(`Room ${roomName} does not exist in db.`);
			return null;
		}
		return dbToRoomArgs(dbroom);
	} catch (err) {
		log.error(`Failed to get room by name: ${err}`);
	}
	return null;
}

export async function isRoomNameTaken(roomName: string): Promise<boolean> {
	try {
		const room = await DbRoomModel.findOne({
			where: Sequelize.and(
				Sequelize.where(
					Sequelize.fn("lower", Sequelize.col("name")),
					Sequelize.fn("lower", roomName)
				)
			),
		});
		return !!room;
	} catch (err) {
		log.error(`${err} ${err.stack}`);
		throw err;
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
		grants: new permissions.Grants(),
		userRoles: new Map<Role, Set<number>>(),
		autoSkipSegments: db.autoSkipSegments,
	};
	if (db.permissions) {
		room.grants.deserialize(db.permissions);
	}
	for (let i = Role.TrustedUser; i <= 4; i++) {
		room.userRoles.set(i, new Set(JSON.parse(db[`role-${permissions.ROLE_NAMES[i]}`])));
	}
	return room;
}
