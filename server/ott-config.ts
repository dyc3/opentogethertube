import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import validator from "validator";
import { getLogger, setLogLevel } from "./logger.js";
import convict from "convict";
import toml from "toml";

const log = getLogger("config");

convict.addParser({ extension: "toml", parse: toml.parse });

export const conf = convict({
	env: {
		doc: "The application environment.",
		format: ["production", "development", "test"],
		default: "development",
		env: "NODE_ENV",
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
			env: "LOG_FILE",
		},
	},
	db: {
		mode: {
			doc: "The database mode to use.",
			format: ["sqlite", "postgres"],
			default: "sqlite",
			env: "DB_MODE",
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
		youtube: {
			api_key: {
				doc: "Youtube API key.",
				format: String,
				env: "YOUTUBE_API_KEY",
				sensitive: true,
			},
		},
		direct: {
			ffprobe_path: {
				doc: "Path to ffprobe.",
				format: String,
				env: "FFPROBE_PATH",
			},
		},
		google_drive: {
			api_key: {
				doc: "Google Drive API key.",
				format: String,
				env: "GOOGLE_DRIVE_API_KEY",
				sensitive: true,
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
		sensitive: true,
	},
	session_secret: {
		doc: "Session secret used for cookies.",
		format: String,
		env: "SESSION_SECRET",
		sensitive: true,
	},
	discord: {
		client_id: {
			doc: "Discord client ID. Required for discord login.",
			format: String,
			env: "DISCORD_CLIENT_ID",
		},
		client_secret: {
			doc: "Discord client secret. Required for discord login.",
			format: String,
			env: "DISCORD_CLIENT_SECRET",
			sensitive: true,
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
	},
});

export function loadConfigFile() {
	const configPath = path.resolve(process.cwd(), "../env/base.toml");
	if (!fs.existsSync(configPath)) {
		log.warn(`No config found at ${configPath}`);
	}

	log.info(`Loading config from ${configPath}`);
	conf.loadFile(configPath);

	let environment = conf.get("env");
	let envConfigPath = path.resolve(process.cwd(), `../env/${environment}.toml`);
	if (fs.existsSync(configPath)) {
		log.info(`Loading environment config from ${envConfigPath}`);
		conf.loadFile(envConfigPath);
	} else {
		log.warn(`No environment config found at ${configPath}`);
	}
}

const isOfficial = process.env.OTT_HOSTNAME === "opentogethertube.com";

type ValidatorFn = (value: string) => boolean;

type ConfigValidatorEntry = {
	required: boolean;
	validator: ValidatorFn;
};

// configuration validation
// key: config variable
// value: object:
//   required: bool Indicates whether or not this variable is required to function.
//   validator: function that returns true if the value is valid
export const configValidators: Record<string, ConfigValidatorEntry> = {
	OTT_HOSTNAME: {
		required: process.env.NODE_ENV === "production",
		validator: value =>
			validator.isIP(value) ||
			validator.isURL(value, { disallow_auth: true }) ||
			value.includes("localhost"),
	},
	DISCORD_CLIENT_ID: {
		required: process.env.NODE_ENV === "production" && isOfficial,
		validator: value =>
			!isOfficial || (value.length >= 18 && validator.isNumeric(value, { no_symbols: true })),
	},
	DISCORD_CLIENT_SECRET: {
		required: process.env.NODE_ENV === "production" && isOfficial,
		validator: value => !isOfficial || value.length >= 32,
	},
	OPENTOGETHERTUBE_API_KEY: {
		required: false,
		validator: value =>
			process.env.NODE_ENV !== "production" ||
			(value !== "GENERATE_YOUR_OWN_API_KEY" && value.length >= 40),
	},
	SESSION_SECRET: {
		required: process.env.NODE_ENV === "production",
		validator: value =>
			process.env.NODE_ENV !== "production" ||
			!isOfficial ||
			(value !== "GENERATE_YOUR_OWN_SECRET" && value.length >= 80),
	},
	// eslint-disable-next-line array-bracket-newline
	LOG_LEVEL: {
		required: false,
		validator: value => !value || ["silly", "debug", "info", "warn", "error"].includes(value),
	},
	YOUTUBE_API_KEY: {
		required: process.env.NODE_ENV === "production",
		validator: value => process.env.NODE_ENV !== "production" || value !== "API_KEY_GOES_HERE",
	},
	DB_MODE: {
		required: false,
		validator: value => !value || ["sqlite", "postgres"].includes(value),
	},
	ADD_PREVIEW_SEARCH_MIN_LENGTH: {
		required: false,
		validator: value => !value || validator.isNumeric(value, { no_symbols: true }),
	},
	ENABLE_SEARCH: {
		required: false,
		validator: value => !value || ["true", "false"].includes(value),
	},
	// TODO: check which info extractors implement searching videos
	// eslint-disable-next-line array-bracket-newline
	SEARCH_PROVIDER: { required: false, validator: value => !value || ["youtube"].includes(value) },
	ADD_PREVIEW_PLAYLIST_RESULTS_COUNT: {
		required: false,
		validator: value => !value || validator.isNumeric(value, { no_symbols: true }),
	},
	ADD_PREVIEW_SEARCH_RESULTS_COUNT: {
		required: false,
		validator: value => !value || validator.isNumeric(value, { no_symbols: true }),
	},
	ENABLE_RATE_LIMIT: {
		required: false,
		validator: value => !value || ["true", "false"].includes(value),
	},
};

let configCalidationFailed = false;
for (let configVar in configValidators) {
	const rules = configValidators[configVar];
	const configValue = process.env[configVar];
	if (rules.required && !configValue) {
		log.error(`${configVar} is required, but it was not found.`);
		configCalidationFailed = true;
	} else if (configValue && !rules.validator(configValue)) {
		log.error(`${configVar} is invalid.`);
		configCalidationFailed = true;
	}
}

if (configCalidationFailed) {
	log.error("Config validation FAILED! Check your config!");
	process.exit(1);
}

if (process.env.LOG_LEVEL) {
	log.info(`Set log level to ${process.env.LOG_LEVEL}`);
	setLogLevel(process.env.LOG_LEVEL);
}

if (!process.env.DB_MODE) {
	process.env.DB_MODE =
		process.env.DATABASE_URL ||
		process.env.POSTGRES_DB_HOST ||
		process.env.POSTGRES_DB_NAME ||
		process.env.POSTGRES_DB_USERNAME ||
		process.env.POSTGRES_DB_PASSWORD
			? "postgres"
			: "sqlite";
}
log.info(`Database mode: ${process.env.DB_MODE}`);

if (process.env.ENABLE_SEARCH === undefined) {
	process.env.ENABLE_SEARCH = "true";
}
log.info(`Search enabled: ${process.env.ENABLE_SEARCH}`);

if (!process.env.SEARCH_PROVIDER) {
	process.env.SEARCH_PROVIDER = "youtube";
}
log.info(`Search provider: ${process.env.SEARCH_PROVIDER}`);

if (process.env.ENABLE_RATE_LIMIT === undefined) {
	process.env.ENABLE_RATE_LIMIT = "true";
}
log.info(`Rate limiting enabled: ${process.env.ENABLE_RATE_LIMIT}`);
