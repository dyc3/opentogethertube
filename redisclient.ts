import redis from 'redis';

const redisOptions: redis.ClientOpts = (process.env.REDIS_TLS_URL || process.env.REDIS_URL) ?
	{
		url: process.env.REDIS_TLS_URL || process.env.REDIS_URL,
		tls: {
			rejectUnauthorized: false,
		},
} : {
	port: parseInt(process.env.REDIS_PORT) || undefined,
	host: process.env.REDIS_HOST || undefined,
	password: process.env.REDIS_PASSWORD || undefined,
	db: process.env.REDIS_DB || undefined,
};

export const redisClient = redis.createClient(redisOptions);

export function createSubscriber(): redis.RedisClient {
	return redis.createClient(redisOptions);
}

module.exports = {
	redisClient,
	createSubscriber,
};
