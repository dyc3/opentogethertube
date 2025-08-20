import { sequelize } from "./models/index.js";
import { conf } from "./ott-config.js";
import {
	getManyVideoInfo,
	getVideoInfo,
	getVideoInfoFields,
	updateManyVideoInfo,
	updateVideoInfo,
} from "./storage/cachedvideo.js";
import {
	deleteRoom,
	getRoomByName,
	isRoomNameTaken,
	saveRoom,
	updateRoom,
} from "./storage/room.js";
import { setupPostgresMetricsCollection } from "./storage.metrics.js";

export default {
	getRoomByName,
	isRoomNameTaken,
	saveRoom,
	updateRoom,
	deleteRoom,
	getVideoInfo,
	getManyVideoInfo,
	updateVideoInfo,
	updateManyVideoInfo,
	getVideoInfoFields,
};
