"use strict";
import { Sequelize, Model, DataTypes, Optional } from "sequelize";
import { QueueMode, Visibility, Role } from "../../common/models/types";
import { User } from "./user";
import { ROOM_NAME_REGEX } from "../../common/constants";
import type { OldRoleGrants, GrantMask } from "../../common/permissions";

export interface RoomAttributes {
	"id": number;
	"name": string;
	"title": string;
	"description": string;
	"visibility": Visibility;
	"queueMode": QueueMode;
	"ownerId": number | null;
	"permissions": [Role, GrantMask][] | OldRoleGrants;
	"role-admin": Array<number>;
	"role-mod": Array<number>;
	"role-trusted": Array<number>;
	"autoSkipSegments": boolean;
}

type RoomCreationAttributes = Optional<RoomAttributes, "id">;

export class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
	declare "id": number;
	public declare readonly "createdAt": Date;
	public declare readonly "updatedAt": Date;
	declare "name": string;
	declare "title": string;
	declare "description": string;
	declare "visibility": Visibility;
	declare "queueMode": QueueMode;
	declare "ownerId": number | null;
	declare "owner": User | null;
	declare "permissions": [Role, GrantMask][] | OldRoleGrants;
	declare "role-admin": Array<number>;
	declare "role-mod": Array<number>;
	declare "role-trusted": Array<number>;
	declare "autoSkipSegments": boolean;
}

export const createModel = (sequelize: Sequelize) => {
	Room.init(
		{
			"id": {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			"name": {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
				validate: {
					is: ROOM_NAME_REGEX,
					len: [3, 32],
				},
			},
			"title": DataTypes.STRING,
			"description": DataTypes.TEXT,
			"visibility": {
				type: DataTypes.STRING,
				defaultValue: Visibility.Public,
				validate: {
					// eslint-disable-next-line array-bracket-newline
					isIn: [[Visibility.Public, Visibility.Unlisted, Visibility.Private]],
				},
			},
			"queueMode": {
				type: DataTypes.STRING,
				defaultValue: QueueMode.Manual,
				validate: {
					// eslint-disable-next-line array-bracket-newline
					isIn: [[QueueMode.Manual, QueueMode.Vote, QueueMode.Loop, QueueMode.Dj]],
				},
			},
			"ownerId": {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			"permissions": {
				type: DataTypes.JSONB,
			},
			"role-admin": {
				type: DataTypes.JSONB,
			},
			"role-mod": {
				type: DataTypes.JSONB,
			},
			"role-trusted": {
				type: DataTypes.JSONB,
			},
			"autoSkipSegments": {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
		},
		{
			sequelize,
			modelName: "Room",
		}
	);

	return Room;
};

export default createModel;
