const redis = require('redis');

const redisOptions = (process.env.REDIS_TLS_URL || process.env.REDIS_URL) ?
	{
		url: process.env.REDIS_TLS_URL || process.env.REDIS_URL,
		tls: {
			rejectUnauthorized: false,
		},
} : {
	port: process.env.REDIS_PORT || undefined,
	host: process.env.REDIS_HOST || undefined,
	password: process.env.REDIS_PASSWORD || undefined,
	db: process.env.REDIS_DB || undefined,
};

const redisClient = redis.createClient(redisOptions);

function createSubscriber() {
	return redis.createClient(redisOptions);
}

module.exports = {
	redisClient,
	createSubscriber,
};
