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

export default {
	development: {
		username: "root",
		password: null,
		database: conf.get("db.name"),
		host: "127.0.0.1",
		dialect: "sqlite",
		storage: `db/${conf.get("env")}.sqlite`,
	},
	test: {
		username: "root",
		password: null,
		database: conf.get("db.name"),
		host: "127.0.0.1",
		dialect: "sqlite",
		storage: `db/${conf.get("env")}.sqlite`,
	},
	production:
		conf.get("db.mode") === "sqlite"
			? {
					username: "root",
					password: null,
					database: conf.get("db.name"),
					host: "127.0.0.1",
					dialect: "sqlite",
					storage: `db/${conf.get("env")}.sqlite`,
			  }
			: conf.get("db.url")
			? {
					url: conf.get("db.url"),
					dialect: "postgres",
					ssl: { rejectUnauthorized: false },
					dialectOptions: {
						ssl: { rejectUnauthorized: false },
					},
			  }
			: {
					username: conf.get("db.user"),
					password: conf.get("db.password"),
					database: conf.get("db.name"),
					host: conf.get("db.host"),
					dialect: "postgres",
			  },
};
