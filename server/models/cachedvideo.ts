"use strict";
import { Sequelize, Model, DataTypes, Optional } from "sequelize";

interface CachedVideoAttributes {
	id: number;
	service: string;
	serviceId: string;
	title?: string;
	description?: string;
	thumbnail?: string;
	length?: number;
	mime?: string;
}

type CachedVideoCreationAttributes = Optional<CachedVideoAttributes, "id">;

export class CachedVideo
	extends Model<CachedVideoAttributes, CachedVideoCreationAttributes>
	implements CachedVideoAttributes
{
	declare id: number;
	public declare readonly createdAt: Date;
	public declare readonly updatedAt: Date;
	declare service: string;
	declare serviceId: string;
	declare title?: string;
	declare description?: string;
	declare thumbnail?: string;
	declare length?: number;
	declare mime?: string;
}

const createModel = (sequelize: Sequelize) => {
	CachedVideo.init(
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			service: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			serviceId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			title: DataTypes.STRING,
			description: DataTypes.TEXT,
			thumbnail: DataTypes.STRING,
			length: DataTypes.INTEGER,
			mime: DataTypes.STRING,
		},
		{
			sequelize,
			modelName: "CachedVideo",
		}
	);

	return CachedVideo;
};

export default createModel;
module.exports = createModel;
