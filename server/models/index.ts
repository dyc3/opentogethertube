import { initDb } from "../database/client.js";
import { CachedVideo } from "./cachedvideo.js";
import { Room } from "./room.js";
import { User } from "./user.js";

export function loadModels() {
	return initDb();
}

export { Room, User, CachedVideo };
