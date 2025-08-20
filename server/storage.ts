import { sequelize } from "./models/index.js";
import { setupPostgresMetricsCollection } from "./storage.metrics.js";
import { conf } from "./ott-config.js";
import {
	getRoomByName,
	isRoomNameTaken,
	saveRoom,
	updateRoom,
	deleteRoom,
} from "./storage/room.js";
import {
	getVideoInfo,
	getManyVideoInfo,
	updateVideoInfo,
	updateManyVideoInfo,
	getVideoInfoFields,
} from "./storage/cachedvideo.js";

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
