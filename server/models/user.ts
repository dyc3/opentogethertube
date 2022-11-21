"use strict";
import { Sequelize, Model, DataTypes, Optional } from "sequelize";
import { UserAccountAttributes } from "ott-common/models/types";

type UserCreationAttributes = Optional<UserAccountAttributes, "id">;

export class User
	extends Model<UserAccountAttributes, UserCreationAttributes>
{}

const createModel = (sequelize: Sequelize) => {
	User.init(
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			username: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
				validate: {
					len: [1, 255],
				},
			},
			email: {
				type: DataTypes.STRING,
				allowNull: true,
				unique: true,
				validate: {
					isEmail: {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore because I think the type annotation is wrong.
						args: [
							{
								require_tld: process.env.NODE_ENV === "production",
							},
						],
					},
				},
			},
			salt: {
				type: DataTypes.BLOB,
				allowNull: true,
				validate: {
					len: [1, 256],
				},
			},
			hash: {
				type: DataTypes.BLOB,
				allowNull: true,
			},
			discordId: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		},
		{
			sequelize,
			modelName: "User",
			validate: {
				ensureCredentials() {
					if ((!this.email || !this.hash || !this.salt) && !this.discordId) {
						throw new Error(
							"Incomplete login credentials. Requires social login or email/password."
						);
					}
				},
			},
		}
	);
	// // eslint-disable-next-line no-unused-vars
	// User.associate = function(models) {
	//   // User.hasMany(models.Room, { as: "rooms" });
	// };
	return User;
};

export default createModel;
module.exports = createModel;
