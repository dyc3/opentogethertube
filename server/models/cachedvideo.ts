import { ALL_VIDEO_SERVICES } from "ott-common/constants";
import { VideoService } from "ott-common/models/video";
import { Sequelize, Model, DataTypes, Optional } from "sequelize";

interface CachedVideoAttributes {
	id: number;
	service: VideoService;
	serviceId: string;
	title?: string;
	description?: string;
	thumbnail?: string;
	length?: number;
	mime?: string;
}

export type CachedVideoCreationAttributes = Omit<CachedVideoAttributes, "id">;

export class CachedVideo
	extends Model<CachedVideoAttributes, CachedVideoCreationAttributes>
	implements CachedVideoAttributes
{
	declare id: number;
	public declare readonly createdAt: Date;
	public declare readonly updatedAt: Date;
	declare service: VideoService;
	declare serviceId: string;
	declare title?: string;
	declare description?: string;
	declare thumbnail?: string;
	declare length?: number;
	declare mime?: string;
}

export const createModel = (sequelize: Sequelize) => {
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
				validate: {
					isIn: [ALL_VIDEO_SERVICES],
				},
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
