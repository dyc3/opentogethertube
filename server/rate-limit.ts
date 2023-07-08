import { getLogger } from "./logger.js";
import { redisClient } from "./redisclient";
import {
	IRateLimiterStoreOptions,
	RateLimiterMemory,
	RateLimiterRedis,
	RateLimiterAbstract,
	RateLimiterRes,
} from "rate-limiter-flexible";
import { conf } from "./ott-config";

const log = getLogger("api/rate-limit");

export let rateLimiter: RateLimiterAbstract;
export function buildRateLimiter() {
	const rateLimitOpts: IRateLimiterStoreOptions = {
		storeClient: redisClient,
		points: conf.get("env") === "test" ? 9999999999 : 1000,
		duration: 60 * 60, // seconds
		blockDuration: conf.get("env") === "development" ? 1 : 120,
		inmemoryBlockOnConsumed: conf.get("env") === "test" ? 9999999999 : 1000,
		inmemoryBlockDuration: conf.get("env") === "development" ? 1 : 120,
		keyPrefix: conf.get("rate_limit.key_prefix"),
	};

	rateLimiter =
		conf.get("env") === "test"
			? new RateLimiterMemory(rateLimitOpts)
			: new RateLimiterRedis(rateLimitOpts);
}

export async function consumeRateLimitPoints(
	res,
	key: string,
	points: number,
	limiter: RateLimiterAbstract = rateLimiter
): Promise<boolean> {
	if (!conf.get("rate_limit.enabled")) {
		return true;
	}
	try {
		let info = await limiter.consume(key, points);
		setRateLimitHeaders(res, info);
		return true;
	} catch (e) {
		if (e instanceof Error) {
			throw e;
		} else {
			handleRateLimit(res, e);
			return false;
		}
	}
}

export function setRateLimitHeaders(res, info: RateLimiterRes) {
	res.set("X-RateLimit-Limit", rateLimiter.points);
	res.set("X-RateLimit-Remaining", info.remainingPoints);
	res.set("X-RateLimit-Reset", new Date(Date.now() + info.msBeforeNext));
}

export function handleRateLimit(res, info: RateLimiterRes) {
	log.debug(`Rate limit hit: ${JSON.stringify(info)}`);
	const secs = Math.round(info.msBeforeNext / 1000) || 1;
	res.set("Retry-After", String(secs));
	setRateLimitHeaders(res, info);
	res.status(429).json({
		success: false,
		error: {
			name: "TooManyRequests",
			message: "Too many requests.",
		},
	});
}

export default {
	consumeRateLimitPoints,
	setRateLimitHeaders,
	handleRateLimit,
};
