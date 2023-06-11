"use strict";
import { Sequelize, Model, DataTypes, Optional } from "sequelize";
import { QueueMode, Visibility } from "../../common/models/types";
import { User } from "./user";
import { ROOM_NAME_REGEX } from "../../common/constants";

export interface RoomAttributes {
	"id": number;
	"name": string;
	"title": string;
	"description": string;
	"visibility": Visibility;
	"queueMode": QueueMode;
	"ownerId": number;
	"permissions": string;
	"role-admin": string;
	"role-mod": string;
	"role-trusted": string;
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
	declare "ownerId": number;
	declare "owner": User;
	declare "permissions": string;
	declare "role-admin": string;
	declare "role-mod": string;
	declare "role-trusted": string;
	declare "autoSkipSegments": boolean;
}

const createModel = (sequelize: Sequelize) => {
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
				defaultValue: -1,
				allowNull: false,
				validate: {
					min: -1,
				},
			},
			"permissions": {
				type: DataTypes.TEXT,
			},
			"role-admin": {
				type: DataTypes.TEXT,
			},
			"role-mod": {
				type: DataTypes.TEXT,
			},
			"role-trusted": {
				type: DataTypes.TEXT,
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
module.exports = createModel;
