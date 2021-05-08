const redis = require('redis');

const redisClient = (process.env.REDIS_TLS_URL || process.env.REDIS_URL) ?
	redis.createClient(process.env.REDIS_TLS_URL || process.env.REDIS_URL, {
		tls: {
			rejectUnauthorized: false,
		},
	}) :
	redis.createClient({
		port: process.env.REDIS_PORT || undefined,
		host: process.env.REDIS_HOST || undefined,
		password: process.env.REDIS_PASSWORD || undefined,
		db: process.env.REDIS_DB || undefined,
	});

module.exports = {
	redisClient,
};
