import { getLogger } from "./logger.js";
import { redisClient } from "./redisclient";
import {
	IRateLimiterStoreOptions,
	RateLimiterMemory,
	RateLimiterRedis,
	type RateLimiterAbstract,
	RateLimiterStoreAbstract,
	RateLimiterRes,
} from "rate-limiter-flexible";
import { conf } from "./ott-config";
import { RedisClientType } from "redis";

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
			: new RateLimiterRedisv4(rateLimitOpts);
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

const incrTtlLuaScript = `redis.call('set', KEYS[1], 0, 'EX', ARGV[2], 'NX') \
local consumed = redis.call('incrby', KEYS[1], ARGV[1]) \
local ttl = redis.call('pttl', KEYS[1]) \
if ttl == -1 then \
  redis.call('expire', KEYS[1], ARGV[2]) \
  ttl = 1000 * ARGV[2] \
end \
return {consumed, ttl} \
`;

/**
 * This rate limiter is a workaround for redis v4 not being supported by rate-limiter-flexible yet.
 * See: https://github.com/animir/node-rate-limiter-flexible/pull/176
 */
export class RateLimiterRedisv4 extends RateLimiterRedis {
	client: RedisClientType;

	constructor(options: IRateLimiterStoreOptions) {
		super(options);

		this.client = options.storeClient;
	}

	_getRateLimiterRes(_key, changedPoints, result) {
		const [consumed, resTtlMs] = result;

		const consumedPoints = parseInt(consumed);
		const isFirstInDuration = consumedPoints === changedPoints;
		const remainingPoints = Math.max(this.points - consumedPoints, 0);
		const msBeforeNext = resTtlMs;

		return new RateLimiterRes(remainingPoints, msBeforeNext, consumedPoints, isFirstInDuration);
	}

	_upsert(key: string, points: number, msDuration, forceExpire = false) {
		const multi = this.client.multi();

		if (forceExpire) {
			if (msDuration > 0) {
				multi.set(key, points, { PX: msDuration });
			} else {
				multi.set(key, points);
			}

			return multi.pTTL(key).exec(true);
		}

		if (msDuration > 0) {
			return this.client.eval(incrTtlLuaScript, {
				keys: [key],
				arguments: [String(points), String(msDuration / 1000)],
			});
		}

		return multi.incrBy(key, points).pTTL(key).exec(true);
	}

	_get(key: string) {
		return this.client
			.multi()
			.get(key)
			.pTTL(key)
			.exec(true)
			.then(result => {
				const [points] = result;
				if (points === null) {
					return null;
				}
				return result;
			});
	}

	_delete(key: string) {
		return this.client.del(key).then(result => result > 0);
	}
}

export default {
	consumeRateLimitPoints,
	setRateLimitHeaders,
	handleRateLimit,
};
