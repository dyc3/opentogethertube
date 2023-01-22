import redis from "redis";
import { promisify } from "util";
import { Counter, Gauge } from "prom-client";
import { getLogger } from "./logger";
const log = getLogger("redisclient");

const redisOptions: redis.ClientOpts =
	process.env.REDIS_TLS_URL || process.env.REDIS_URL
		? {
				url: process.env.REDIS_TLS_URL || process.env.REDIS_URL,
				tls: {
					rejectUnauthorized: false,
				},
		  }
		: {
				port: parseInt(process.env.REDIS_PORT ?? "", 10) || undefined,
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

function wrapInAsync(client: redis.RedisClient): RedisClientAsync {
	return {
		get: promisify(redisClient.get).bind(redisClient) as (key: string) => Promise<string>,
		set: promisify(redisClient.set).bind(redisClient) as (
			key: string,
			value: string,
			mode?: string,
			duration?: number
		) => Promise<"OK">,
		del: promisify(redisClient.del).bind(redisClient) as (key: string) => Promise<number>,
		exists: promisify(redisClient.exists).bind(redisClient) as (key: string) => Promise<number>,
		keys: promisify(redisClient.keys).bind(redisClient) as (
			pattern: string
		) => Promise<string[]>,
		incr: promisify(redisClient.incr).bind(redisClient) as (key: string) => Promise<number>,
		incrby: promisify(redisClient.incrby).bind(redisClient) as (
			key: string,
			amount: number
		) => Promise<number>,
		publish: promisify(redisClient.publish).bind(redisClient) as (
			channel: string,
			message: string
		) => Promise<number>,
		info: promisify(redisClient.info).bind(redisClient) as (
			section?: string
		) => Promise<string>,
		dbsize: promisify(redisClient.dbsize).bind(redisClient) as () => Promise<number>,

		/**
		 * Deletes keys that match the specified pattern. Probably very slow. Not for use in production.
		 * @param patterns Patterns of keys to delete
		 */
		async delPattern(...patterns: string[]): Promise<void> {
			for (const pattern of patterns) {
				for (const key of await this.keys(pattern)) {
					await this.del(key);
				}
			}
		},
	};
}

export interface RedisClientAsync {
	get(key: string): Promise<string>;
	set(key: string, value: string, mode?: string, duration?: number): Promise<"OK">;
	del(key: string): Promise<number>;
	exists(key: string): Promise<number>;
	keys(key: string): Promise<string[]>;
	incr(key: string): Promise<number>;
	incrby(key: string, amount: number): Promise<number>;
	publish(channel: string, message: string): Promise<number>;
	info(section?: string): Promise<string>;
	dbsize(): Promise<number>;

	delPattern(...patterns: string[]): Promise<void>;
}

export const redisClientAsync: RedisClientAsync = wrapInAsync(redisClient);

function parseRedisInfo(lines: string[]): Record<string, string> {
	const info: Record<string, string> = {};
	for (const _line of lines) {
		const line = _line.trim();
		if (line.startsWith("#")) {
			continue;
		}
		if (!line.includes(":")) {
			continue;
		}
		const [key, value] = line.split(":");
		info[key] = value;
	}
	return info;
}

/** Map of the redis metric name to our prometheus counter. */
let redisMetrics: Record<string, Counter | Gauge> = {};

export async function registerRedisMetrics(): Promise<void> {
	if (Object.keys(redisMetrics).length > 0) {
		return;
	}

	redisMetrics["used_memory"] = new Gauge({
		name: "redis_used_memory",
		help: "The amount of memory used by Redis",
	});

	redisMetrics["used_memory_rss"] = new Gauge({
		name: "redis_used_memory_rss",
		help: "The amount of memory used by Redis, including the shared memory",
	});

	redisMetrics["used_memory_peak"] = new Gauge({
		name: "redis_used_memory_peak",
		help: "The peak amount of memory used by Redis",
	});

	redisMetrics["used_memory_lua"] = new Gauge({
		name: "redis_used_memory_lua",
		help: "The amount of memory used by Lua",
	});

	redisMetrics["used_memory_scripts"] = new Gauge({
		name: "redis_used_memory_scripts",
		help: "The amount of memory used by Redis scripts",
	});

	redisMetrics["maxmemory"] = new Gauge({
		name: "redis_maxmemory",
		help: "The maximum amount of memory Redis can use",
	});

	redisMetrics["mem_fragmentation_ratio"] = new Gauge({
		name: "redis_mem_fragmentation_ratio",
		help: "The ratio of used_memory_rss to used_memory",
	});

	redisMetrics["mem_fragmentation_bytes"] = new Gauge({
		name: "redis_mem_fragmentation_bytes",
		help: "The difference between used_memory_rss and used_memory",
	});

	redisMetrics["mem_clients_normal"] = new Gauge({
		name: "redis_mem_clients_normal",
		help: "The amount of memory used by normal clients",
	});

	redisMetrics["total_connections_received"] = new Counter({
		name: "redis_total_connections_received",
		help: "The total number of connections received by Redis",
	});

	redisMetrics["total_commands_processed"] = new Counter({
		name: "redis_total_commands_processed",
		help: "The total number of commands processed by Redis",
	});

	redisMetrics["instantaneous_ops_per_sec"] = new Gauge({
		name: "redis_instantaneous_ops_per_sec",
		help: "The number of commands processed per second",
	});

	redisMetrics["total_net_input_bytes"] = new Counter({
		name: "redis_total_net_input_bytes",
		help: "The total number of bytes read from the network by Redis",
	});

	redisMetrics["total_net_output_bytes"] = new Counter({
		name: "redis_total_net_output_bytes",
		help: "The total number of bytes sent to the network by Redis",
	});

	redisMetrics["expired_keys"] = new Gauge({
		name: "redis_expired_keys",
		help: "The number of keys that have expired",
	});

	redisMetrics["evicted_keys"] = new Gauge({
		name: "redis_evicted_keys",
		help: "The number of keys that have been evicted",
	});

	redisMetrics["keyspace_hits"] = new Counter({
		name: "redis_keyspace_hits",
		help: "The number of successful lookup of keys in the main dictionary",
	});

	redisMetrics["keyspace_misses"] = new Counter({
		name: "redis_keyspace_misses",
		help: "The number of failed lookup of keys in the main dictionary",
	});

	redisMetrics["pubsub_channels"] = new Gauge({
		name: "redis_pubsub_channels",
		help: "The number of active channels",
	});

	redisMetrics["total_reads_processed"] = new Counter({
		name: "redis_total_reads_processed",
		help: "The total number of reads processed by Redis",
	});

	redisMetrics["total_writes_processed"] = new Counter({
		name: "redis_total_writes_processed",
		help: "The total number of writes processed by Redis",
	});

	await collectRedisMetrics();
	setInterval(async () => {
		await collectRedisMetrics();
	}, 1000 * 60);
}

async function collectRedisMetrics() {
	log.silly("Collecting redis metrics");
	const redisInfoStats = await redisClientAsync.info("stats");
	const redisInfoMemory = await redisClientAsync.info("memory");
	const redisInfoStatsParsed = parseRedisInfo(redisInfoStats.trim().split("\n"));
	const redisInfoMemoryParsed = parseRedisInfo(redisInfoMemory.trim().split("\n"));
	const mergedInfo = { ...redisInfoStatsParsed, ...redisInfoMemoryParsed };

	let countMetricsCollected = 0;
	let countMetricsSkipped = 0;
	for (const [key, value] of Object.entries(mergedInfo)) {
		if (key in redisMetrics) {
			let metric = redisMetrics[key];
			let parsed = Number(value);
			if (metric instanceof Counter) {
				metric.reset();
				metric.inc(parsed);
				countMetricsCollected++;
			} else if (metric instanceof Gauge) {
				metric.set(parsed);
				countMetricsCollected++;
			} else {
				log.warn(`Unknown metric type ${metric}`);
				countMetricsSkipped++;
			}
		}
	}
	log.silly(`Collected ${countMetricsCollected} redis metrics, skipped ${countMetricsSkipped}`);
}

const guageRedisDbsize = new Gauge({
	name: "redis_keys_count",
	help: "The number of keys in the database",
	async collect() {
		const dbsize = await redisClientAsync.dbsize();
		this.set(dbsize);
	},
});

module.exports = {
	redisClient,
	createSubscriber,
	redisClientAsync,
	registerRedisMetrics,
};
