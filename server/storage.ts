// biome-ignore lint/correctness/noUnusedImports: biome migration
import { sequelize } from "./models/index.js";
// biome-ignore lint/correctness/noUnusedImports: biome migration
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
// biome-ignore lint/correctness/noUnusedImports: biome migration
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
