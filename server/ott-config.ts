import fs from "fs";
import path from "path";
import validator from "validator";
import convict from "convict";
import toml from "toml";
import type winston from "winston";
import { ALL_VIDEO_SERVICES } from "../common/constants";

convict.addParser({ extension: "toml", parse: toml.parse });

// Note that all schema objects MUST include `default`, even if its set to null
// A default value of null and nullable == false will make the option required

convict.addFormat({
	name: "balancer-config",
	validate: (sources, schema) => {
		if (!Array.isArray(sources)) {
			throw new Error("Balancer config must be an array");
		}

		for (let source of sources) {
			convict(schema.children).load(source).validate();
		}
	},
});

export const conf = convict({
	env: {
		doc: "The application environment.",
		format: ["production", "development", "test"],
		default: "development",
		env: "NODE_ENV",
	},
	docker: {
		doc: "Whether the server is running in a docker container.",
		format: Boolean,
		default: false,
		env: "DOCKER",
	},
	heroku: {
		doc: "Whether the server is running on heroku.",
		format: Boolean,
		default: false,
		env: "HEROKU",
	},
	port: {
		doc: "The port to bind.",
		format: "port",
		default: 3000,
		env: "PORT",
	},
	hostname: {
		doc: "The domain name that the server is running on.",
		format: String,
		default: "localhost",
		env: "OTT_HOSTNAME",
	},
	base_url: {
		doc: "The base URL of the server.",
		format: String,
		default: "",
		env: "OTT_BASE_URL",
	},
	log: {
		level: {
			doc: "The log level to use.",
			format: ["silly", "debug", "info", "warn", "error"],
			default: "info",
			env: "LOG_LEVEL",
		},
		file: {
			doc: "The file to output logs to. If not provided, logs will only be printed to stdout.",
			format: String,
			default: null,
			env: "LOG_FILE",
			nullable: true,
		},
	},
	db: {
		mode: {
			doc: "The database mode to use.",
			format: ["sqlite", "postgres"],
			default: "sqlite",
			env: "DB_MODE",
		},
		url: {
			doc: "The database connection URL.",
			format: String,
			default: null,
			env: "DATABASE_URL",
			nullable: true,
			sensitive: true,
		},
		host: {
			doc: "The database host.",
			format: String,
			default: "localhost",
			env: "POSTGRES_HOST",
		},
		port: {
			doc: "The database port.",
			format: "port",
			default: 5432,
			env: "POSTGRES_PORT",
		},
		name: {
			doc: "The database name.",
			format: String,
			default: "opentogethertube",
			env: "POSTGRES_DB",
		},
		user: {
			doc: "The database user.",
			format: String,
			default: "ott",
			env: "POSTGRES_USER",
		},
		password: {
			doc: "The database user's password.",
			format: String,
			default: null as string | null,
			env: "POSTGRES_PASSWORD",
			nullable: true,
			sensitive: true,
		},
		metrics: {
			doc: "Whether to allow OTT to collect database metrics and expose them alongside the rest of the metrics.",
			format: Boolean,
			default: true,
		},
	},
	redis: {
		url: {
			doc: "The redis connection URL.",
			format: String,
			default: "",
			env: "REDIS_URL",
			nullable: true,
			sensitive: true,
		},
		host: {
			doc: "The redis host. The redis URL will take precedence over this option.",
			format: String,
			default: null,
			env: "REDIS_HOST",
			nullable: true,
		},
		port: {
			doc: "The redis port. The redis URL will take precedence over this option.",
			format: "port",
			default: null,
			env: "REDIS_PORT",
			nullable: true,
		},
		username: {
			doc: "The redis username. The redis URL will take precedence over this option.",
			format: String,
			default: null as string | null,
			env: "REDIS_USERNAME",
			nullable: true,
		},
		password: {
			doc: "The redis password. The redis URL will take precedence over this option.",
			format: String,
			default: null as string | null,
			env: "REDIS_PASSWORD",
			nullable: true,
			sensitive: true,
		},
		db: {
			doc: "The redis database. The redis URL will take precedence over this option.",
			format: "nat",
			default: 0,
			env: "REDIS_DB",
		},
		metrics: {
			doc: "Whether to allow OTT to collect redis metrics and expose them alongside the rest of the metrics.",
			format: Boolean,
			default: true,
		},
	},
	add_preview: {
		search: {
			enabled: {
				doc: "Enable search functionality.",
				format: Boolean,
				default: true,
				env: "ENABLE_SEARCH",
			},
			provider: {
				doc: "Search provider to use.",
				format: ["youtube"],
				default: "youtube",
				env: "SEARCH_PROVIDER",
			},
			min_query_length: {
				doc: "Minimum length of a search query.",
				format: "nat",
				default: 3,
				env: "ADD_PREVIEW_SEARCH_MIN_LENGTH",
			},
			results_count: {
				doc: "Number of search results to return.",
				format: "nat",
				default: 8,
				env: "ADD_PREVIEW_SEARCH_RESULTS_COUNT",
			},
		},
		playlist_results_count: {
			doc: "Max number of videos in a playlist to return.",
			format: "nat",
			default: 40,
			env: "ADD_PREVIEW_PLAYLIST_RESULTS_COUNT",
		},
	},
	info_extractor: {
		services: {
			doc: "An allowlist of enabled video services. By default, all services are enabled.",
			format: Array,
			default: ALL_VIDEO_SERVICES,
		},
		youtube: {
			api_key: {
				default: "",
				doc: "Youtube API key.",
				format: String,
				env: "YOUTUBE_API_KEY",
				sensitive: true,
			},
			truncate_description: {
				doc: "The number of characters to truncate the description to, or null to not truncate.",
				format: "nat",
				default: null as number | null,
				nullable: true,
			},
		},
		direct: {
			ffprobe_path: {
				doc: "Path to ffprobe.",
				format: String,
				env: "FFPROBE_PATH",
				default: null,
				nullable: true,
			},
			preview_max_bytes: {
				doc: "Max number of bytes to download to generate a preview of a video.",
				format: "nat",
				default: null,
				env: "DIRECT_PREVIEW_MAX_BYTES",
				nullable: true,
			},
			ffprobe_strategy: {
				doc: "The strategy to use for running ffprobe.",
				format: ["stream", "disk", "run"],
				default: "stream",
				env: "FFPROBE_STRATEGY",
			},
		},
		google_drive: {
			api_key: {
				default: null,
				doc: "Google Drive API key.",
				format: String,
				env: "GOOGLE_DRIVE_API_KEY",
				sensitive: true,
				nullable: true,
			},
		},
		peertube: {
			instances: {
				default: ["the.jokertv.eu", "tube.shanti.cafe", "video.antopie.org"],
				doc: "List of Peertube instances to allow.",
				format: Array,
				env: "PEERTUBE_INSTANCES",
				children: {
					format: String,
				},
			},
			emit_as_direct: {
				default: true,
				doc: "Whether to emit Peertube videos as direct or hls videos instead of Peertube videos. This is useful if the Peertube embeds are broken.",
				format: Boolean,
				env: "PEERTUBE_EMIT_AS_DIRECT",
			},
		},
	},
	rate_limit: {
		enabled: {
			doc: "Enable rate limiting.",
			format: Boolean,
			default: true,
			env: "ENABLE_RATE_LIMIT",
		},
		key_prefix: {
			doc: "The prefix to use for rate limit keys, which are stored in redis.",
			format: String,
			default: "rateLimit",
			env: "RATE_LIMIT_KEY_PREFIX",
		},
	},
	api_key: {
		doc: "API key for the performing admin tasks. If not provided, no admin tasks will be available.",
		format: String,
		env: "OPENTOGETHERTUBE_API_KEY",
		default: "",
		sensitive: true,
	},
	session_secret: {
		default: null as unknown as string,
		format: String,
		env: "SESSION_SECRET",
		sensitive: true,
	},
	discord: {
		client_id: {
			doc: "Discord client ID. Required for discord login.",
			format: String,
			env: "DISCORD_CLIENT_ID",
			default: null,
			nullable: true,
		},
		client_secret: {
			doc: "Discord client secret. Required for discord login.",
			format: String,
			env: "DISCORD_CLIENT_SECRET",
			default: null,
			sensitive: true,
			nullable: true,
		},
	},
	trust_proxy: {
		doc: "How many layers of reverse proxies to trust for source IP addresses.",
		format: "nat",
		default: 1,
		env: "TRUST_PROXY",
	},
	short_url: {
		doc: 'The domain to use in the copyable "Share Invite" URL. This environment var must be present during building the client, otherwise it will not work.',
		format: String,
		env: "OTT_SHORT_URL_HOSTNAME",
		default: "",
		nullable: true,
	},
	force_insecure_cookies: {
		doc: "Force insecure cookies. This is useful if you are running behind a reverse proxy that handles SSL.",
		format: Boolean,
		default: false,
		env: "FORCE_INSECURE_COOKIES",
	},
	balancing: {
		enabled: {
			doc: "Whether to listen for connections from load balancers.",
			format: Boolean,
			default: false,
			env: "BALANCING_ENABLED",
		},
		port: {
			doc: "The port to listen for load balancer connections on.",
			format: "port",
			default: 3002,
			env: "BALANCING_PORT",
		},
	},
	mail: {
		enabled: {
			doc: "Whether to enable sending emails.",
			format: Boolean,
			default: false,
		},
		mailjet_api_key: {
			doc: "Mailjet API key.",
			format: String,
			env: "MAILJET_API_KEY",
			default: null as string | null,
			nullable: true,
			sensitive: true,
		},
		mailjet_api_secret: {
			doc: "Mailjet API secret.",
			format: String,
			env: "MAILJET_API_SECRET",
			default: null as string | null,
			nullable: true,
			sensitive: true,
		},
		sender_email: {
			doc: "Email address to send emails from.",
			format: String,
			default: null as string | null,
			nullable: true,
		},
		sender_name: {
			doc: "Display name to send emails as.",
			format: String,
			default: "OpenTogetherTube",
		},
		mailjet_sandbox: {
			doc: "Whether to use Mailjet's sandbox mode. This will prevent emails from being sent, but will still validate the request.",
			format: Boolean,
			default: false,
		},
	},
	cors_proxy: {
		doc: "The domain name of the cors proxy to use for cors-protected video services. If not provided, cors-protected video services will not work.",
		format: String,
		default: null as string | null,
		nullable: true,
	},
	room: {
		unload_after: {
			doc: "The interval in seconds to after a room is considered inactive that the server will keep the room alive.",
			format: Number,
			default: 300,
		},
	},
});

function getExtraBaseConfig(): string | undefined {
	if (conf.get("heroku")) {
		return "heroku.base.toml";
	} else if (conf.get("docker")) {
		return "docker.base.toml";
	} else {
		return undefined;
	}
}

export function loadConfigFile() {
	let extraBaseConfig = getExtraBaseConfig();
	if (extraBaseConfig) {
		let extraBaseConfigPath = path.resolve(process.cwd(), `../env/${extraBaseConfig}`);
		if (fs.existsSync(extraBaseConfigPath)) {
			log.info(`Loading extra base config from ${extraBaseConfigPath}`);
			conf.loadFile(extraBaseConfigPath);
		} else {
			log.warn(`No extra base config found at ${extraBaseConfigPath}`);
		}
	}

	const configPath = path.resolve(process.cwd(), "../env/base.toml");
	if (fs.existsSync(configPath)) {
		log.info(`Loading config from ${configPath}`);
		conf.loadFile(configPath);
	} else {
		log.warn(`No config found at ${configPath}`);
	}

	let environment = conf.get("env");
	let envConfigPath = path.resolve(process.cwd(), `../env/${environment}.toml`);
	if (fs.existsSync(envConfigPath)) {
		log.info(`Loading environment config from ${envConfigPath}`);
		conf.loadFile(envConfigPath);
	} else {
		log.warn(`No environment config found at ${envConfigPath}`);
	}

	postProcessConfig();

	conf.validate({ allowed: "warn" });
}

function postProcessConfig(): void {
	if (process.env.REDIS_TLS_URL) {
		log.info("Found REDIS_TLS_URL. Using it for redis.url.");
		conf.set("redis.url", process.env.REDIS_TLS_URL);
	}

	if (process.env.POSTGRES_DB_USERNAME) {
		log.warn("POSTGRES_DB_USERNAME is deprecated. Please use POSTGRES_USER instead.");
		conf.set("db.user", process.env.POSTGRES_DB_USERNAME);
	}

	if (process.env.POSTGRES_DB_PASSWORD) {
		log.warn("POSTGRES_DB_PASSWORD is deprecated. Please use POSTGRES_PASSWORD instead.");
		conf.set("db.password", process.env.POSTGRES_DB_PASSWORD);
	}

	if (process.env.POSTGRES_DB_HOST) {
		log.warn("POSTGRES_DB_HOST is deprecated. Please use POSTGRES_HOST instead.");
		conf.set("db.host", process.env.POSTGRES_DB_HOST);
	}

	if (process.env.POSTGRES_DB_NAME) {
		log.warn("POSTGRES_DB_NAME is deprecated. Please use POSTGRES_DB instead.");
		conf.set("db.database", process.env.POSTGRES_DB_NAME);
	}

	if (conf.get("env") === "test") {
		conf.set("session_secret", "test");
	}

	for (const service of conf.get("info_extractor.services")) {
		if (!ALL_VIDEO_SERVICES.includes(service)) {
			log.warn(`Unknown video service ${service} found in config. Ignoring.`);
		}
	}

	if (conf.get("mail.enabled")) {
		validateMail();
	}
}

function validateMail() {
	const sender = conf.get("mail.sender_email");
	if (sender && !validator.isEmail(sender)) {
		log.error(`Invalid email address ${sender} found in config, disabling mail.`);
		conf.set("mail.enabled", false);
		return;
	}

	if (!conf.get("mail.mailjet_api_key") || !conf.get("mail.mailjet_api_secret")) {
		log.error("Mailjet API key and secret are required to send mail, disabling mail.");
		conf.set("mail.enabled", false);
		return;
	}

	if (conf.get("env") === "test") {
		log.warn("Mail is enabled in test mode. Forcing sandbox mode.");
		conf.set("mail.mailjet_sandbox", true);
	}
}

let log: winston.Logger | Console = console;
export function setLogger(l: winston.Logger): void {
	log = l;
}
