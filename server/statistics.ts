import { getLogger } from "../logger.js";
import { redisClientAsync } from "../redisclient";

const log = getLogger("statistics");

export enum Counter {
	VideosQueued = "stats:videos:queued",
	VideosSkipped = "stats:videos:skipped",
	VideosWatched = "stats:videos:watched",
}

export async function bumpCounter(key: Counter, amount = 1): Promise<void> {
	try {
		log.debug(`incrementing ${key} by ${amount}`);
		await redisClientAsync.incrby(key, amount);
	}
	catch (e) {
		log.error(`failed to bump counter, ignoring ${e}`);
	}
}

export default {
	bumpCounter,
};
