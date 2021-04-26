const { getLogger } = require('../logger.js');
const { redisClient } = require('../redisclient.js');
const { RateLimiterRedis } = require('rate-limiter-flexible');

const log = getLogger("api/rate-limit");

const rateLimitOpts = {
	storeClient: redisClient,
	points: 1000,
	duration: 60 * 60, // seconds
	blockDuration: 120,
	inmemoryBlockOnConsumed: 1000,
	inmemoryBlockDuration: 120,
};
const rateLimiter = new RateLimiterRedis(rateLimitOpts);

function setRateLimitHeaders(res, info) {
	res.set('X-RateLimit-Limit', rateLimitOpts.points);
	res.set('X-RateLimit-Remaining', info.remainingPoints);
	res.set('X-RateLimit-Reset', new Date(Date.now() + info.msBeforeNext));
}

function handleRateLimit(res, info) {
	log.debug(`Rate limit hit: ${info}`);
	const secs = Math.round(info.msBeforeNext / 1000) || 1;
	res.set('Retry-After', String(secs));
	setRateLimitHeaders(res, info);
	res.status(429).json({
		success: false,
		error: {
			message: "Too many requests.",
		},
	});
}

module.exports = {
	rateLimiter,
	setRateLimitHeaders,
	handleRateLimit,
};
