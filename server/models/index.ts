import Sequelize from "sequelize";
import type { Model, Options } from "sequelize";
import { getLogger } from "../logger";
import { conf } from "../ott-config";
import { createModel as createModel_Room } from "./room";
import { createModel as createModel_User } from "./user";
import { createModel as createModel_CachedVideo } from "./cachedvideo";

const log = getLogger("db");

export let sequelize: Sequelize.Sequelize;
export function loadModels() {
	log.info("Database models loading");
	const config = getDbConfig();
	sequelize = buildConnection(config);
	buildModels(sequelize);
}

function getDbConfig(): Options {
	const dbmode = conf.get("db.mode");
	const dburl: string | null = conf.get("db.url");

	if (dbmode === "postgres") {
		if (dburl) {
			return {
				dialect: "postgres",
			};
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

function buildConnection(config: Sequelize.Options): Sequelize.Sequelize {
	const heroku = conf.get("heroku");
	const dbmode = conf.get("db.mode");
	const dburl: string | null = conf.get("db.url");

	config.logging = msg => log.silly(msg);

	if (dburl && heroku) {
		// for heroku
		return new Sequelize.Sequelize(dburl, {
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
			return new Sequelize.Sequelize(config.database, "", "", config);
		} else {
			if (!config.username) {
				log.error("No username specified.");
				throw new Error("No username specified.");
			}
			return new Sequelize.Sequelize(
				config.database,
				config.username,
				config.password,
				config
			);
		}
	}
}

export let Room: ReturnType<typeof createModel_Room>;
export let User: ReturnType<typeof createModel_User>;
export let CachedVideo: ReturnType<typeof createModel_CachedVideo>;
function buildModels(sequelize: Sequelize.Sequelize) {
	Room = createModel_Room(sequelize);
	User = createModel_User(sequelize);
	CachedVideo = createModel_CachedVideo(sequelize);

	Room.belongsTo(User, { foreignKey: "ownerId", as: "owner" });
}
