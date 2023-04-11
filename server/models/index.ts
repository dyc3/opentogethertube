"use strict";

import fs from "fs";
import path from "path";
import Sequelize from "sequelize";
import type { Options } from "sequelize";
import { getLogger } from "../logger";
const basename = path.basename(__filename);

import { conf } from "../ott-config";

const log = getLogger("db");

const env = conf.get("env");
const docker = conf.get("docker");
const heroku = conf.get("heroku");
const dbmode = conf.get("db.mode");
const dburl: string | null = conf.get("db.url");

log.info("Environment: " + env);
log.info("Database mode: " + dbmode);
log.info("Is Heroku? " + heroku);
log.info("Is Docker? " + docker);

function getDbConfig(): Options {
	if (dbmode === "postgres") {
		if (dburl) {
			return {
				dialect: "postgres",
			};
		} else {
			return {
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

let config = getDbConfig();
config.logging = msg => log.silly(msg);

let sequelize;
if (dburl && heroku) {
	// for heroku
	sequelize = new Sequelize.Sequelize(dburl, {
		dialect: "postgres",
		protocol: "postgres",
		dialectOptions: {
			ssl: { rejectUnauthorized: false },
		},
		logging: msg => log.silly(msg),
	});
} else {
	if (!config.database) {
		log.error("No database name specified.");
		throw new Error("No database name specified.");
	}
	log.info(`Using database: ${config.database}`);
	if (dbmode === "sqlite") {
		log.info(`Using storage: ${config.storage}`);
		sequelize = new Sequelize.Sequelize(config.database, "", "", config);
	} else {
		if (!config.username) {
			log.error("No username specified.");
			throw new Error("No username specified.");
		}
		sequelize = new Sequelize.Sequelize(
			config.database,
			config.username,
			config.password,
			config
		);
	}
}

const db = {
	sequelize,
	Sequelize,
};

fs.readdirSync(__dirname)
	.filter(file => {
		return (
			file.indexOf(".") !== 0 &&
			file !== basename &&
			(file.slice(-3) === ".js" || file.slice(-3) === ".ts")
		);
	})
	.forEach(file => {
		const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
		db[model.name] = model;
	});

Object.keys(db).forEach(modelName => {
	if (db[modelName].associate) {
		db[modelName].associate(db);
	}
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db["Room"].belongsTo(db["User"], { foreignKey: "ownerId", as: "owner" });

module.exports = db;
export default db;
