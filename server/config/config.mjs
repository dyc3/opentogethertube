// import { conf } from "../ott-config";
import fs from "fs";
import path from "path";
import convict from "convict";

if (process.env.NODE_ENV !== "production") {
	let rootDir = path.resolve(process.cwd());
	if (!fs.existsSync(path.join(rootDir, "./db"))) {
		fs.mkdirSync(path.join(rootDir, "./db"));
	}
}

// HACK: we can't import the config here because sequelize-cli doesn't support typescript imports
// which is actually really really annoying
const conf = convict({
	env: {
		doc: "The application environment.",
		format: ["production", "development", "test"],
		default: "development",
		env: "NODE_ENV",
	},
	heroku: {
		doc: "Whether the server is running on heroku.",
		format: Boolean,
		default: false,
		env: "HEROKU",
	},
	db: {
		mode: {
			doc: "The database mode to use.",
			format: ["sqlite", "postgres"],
			default: process.env.NODE_ENV === "production" ? "postgres" : "sqlite",
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
			default: "ott",
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
			default: null,
			env: "POSTGRES_PASSWORD",
			nullable: true,
			sensitive: true,
		},
	},
});
try {
	conf.load("../env/base.toml");
} catch {
	console.log("No base config found");
}
const env = process.env.NODE_ENV || "development";
try {
	conf.load(`../env/${env}.toml`);
} catch {
	console.log(`No ${env} config found`);
}

function getDbConfig() {
	const dbmode = conf.get("db.mode");
	const dburl = conf.get("db.url");
	const heroku = conf.get("heroku");

	if (dbmode === "postgres") {
		if (dburl) {
			const opts = {
				dialect: "postgres",
				url: dburl,
			};
			if (heroku) {
				opts.dialectOptions = {
					ssl: { rejectUnauthorized: false },
				};
			}
			return opts;
		} else {
			return {
				dialect: "postgres",
				host: conf.get("db.host"),
				port: conf.get("db.port"),
				database: conf.get("db.name"),
				username: conf.get("db.user"),
				password: conf.get("db.password") ?? undefined,
			};
		}
	} else if (dbmode === "sqlite") {
		return {
			dialect: "sqlite",
			database: conf.get("db.name"),
			storage: `db/${conf.get("env")}.sqlite`,
		};
	} else {
		throw new Error(`Unknown db mode: ${dbmode}`);
	}
}

export default {
	development: getDbConfig(),
	test: getDbConfig(),
	production: getDbConfig(),
};
