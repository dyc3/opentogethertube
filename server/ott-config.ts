import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import validator from "validator";
import { getLogger, setLogLevel } from "./logger.js";

const log = getLogger("config");

const config_path = path.resolve(process.cwd(), `../env/${process.env.NODE_ENV}.env`);
log.info(`Reading config from ${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
	log.error(`No config found! Things will break! ${config_path}`);
}
dotenv.config({ path: config_path });

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
