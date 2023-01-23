import { getLogger } from "./logger.js";
import { redisClient } from "./redisclient";
import {
	IRateLimiterStoreOptions,
	RateLimiterMemory,
	RateLimiterRedis,
	RateLimiterAbstract,
	RateLimiterRes,
} from "rate-limiter-flexible";

const log = getLogger("api/rate-limit");

const rateLimitOpts: IRateLimiterStoreOptions = {
	storeClient: redisClient,
	points: process.env.NODE_ENV === "test" ? 9999999999 : 1000,
	duration: 60 * 60, // seconds
	blockDuration: process.env.NODE_ENV === "development" ? 1 : 120,
	inmemoryBlockOnConsumed: process.env.NODE_ENV === "test" ? 9999999999 : 1000,
	inmemoryBlockDuration: process.env.NODE_ENV === "development" ? 1 : 120,
	keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX ?? "rateLimit",
};
export const rateLimiter =
	process.env.NODE_ENV === "test"
		? new RateLimiterMemory(rateLimitOpts)
		: new RateLimiterRedis(rateLimitOpts);

export async function consumeRateLimitPoints(
	res,
	key: string,
	points: number,
	limiter: RateLimiterAbstract = rateLimiter
): Promise<boolean> {
	if (process.env.ENABLE_RATE_LIMIT === "false") {
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
	res.set("X-RateLimit-Limit", rateLimitOpts.points);
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

module.exports = {
	rateLimiter,
	consumeRateLimitPoints,
	setRateLimitHeaders,
	handleRateLimit,
};
export default {
	rateLimiter,
	consumeRateLimitPoints,
	setRateLimitHeaders,
	handleRateLimit,
};
