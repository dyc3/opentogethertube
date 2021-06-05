import redis from 'redis';
import { promisify } from 'util';

const redisOptions: redis.ClientOpts = (process.env.REDIS_TLS_URL || process.env.REDIS_URL) ?
	{
		url: process.env.REDIS_TLS_URL || process.env.REDIS_URL,
		tls: {
			rejectUnauthorized: false,
		},
} : {
	port: parseInt(process.env.REDIS_PORT, 10) || undefined,
	host: process.env.REDIS_HOST || undefined,
	password: process.env.REDIS_PASSWORD || undefined,
	db: process.env.REDIS_DB || undefined,
};

export const redisClient = redis.createClient(redisOptions);

export function createSubscriber(): redis.RedisClient {
	return redis.createClient(redisOptions);
}

// All of the other package solutions I've tried are broken af, so I'll just do this instead.
// These are by no means complete type annotations, just minimal ones to make me happy.
export const redisClientAsync = {
	get: promisify(redisClient.get).bind(redisClient) as ((key: string) => Promise<string>),
	set: promisify(redisClient.set).bind(redisClient) as ((key: string, value: string) => Promise<"OK">),
	del: promisify(redisClient.del).bind(redisClient) as ((key: string) => Promise<number>),
	exists: promisify(redisClient.exists).bind(redisClient) as ((key: string) => Promise<number>),
	keys: promisify(redisClient.keys).bind(redisClient) as ((pattern: string) => Promise<string[]>),
};

module.exports = {
	redisClient,
	createSubscriber,
	redisClientAsync,
};
