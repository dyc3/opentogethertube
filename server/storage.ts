import { sequelize } from "./models";
import { setupPostgresMetricsCollection } from "./storage.metrics";
import { conf } from "./ott-config";
import { getRoomByName, isRoomNameTaken, saveRoom, updateRoom } from "./storage/room";
import {
	getVideoInfo,
	getManyVideoInfo,
	updateVideoInfo,
	updateManyVideoInfo,
	getVideoInfoFields,
} from "./storage/cachedvideo";

export default {
	getRoomByName,
	isRoomNameTaken,
	saveRoom,
	updateRoom,
	getVideoInfo,
	getManyVideoInfo,
	updateVideoInfo,
	updateManyVideoInfo,
	getVideoInfoFields,
};
