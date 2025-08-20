import bodyParser from "body-parser";
import RedisStore from "connect-redis";
import cookieparser from "cookie-parser";
import express from "express";
import session, { SessionOptions } from "express-session";
import fs from "fs";
import http from "http";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { Strategy as BearerStrategy } from "passport-http-bearer";
import { Strategy as LocalStrategy } from "passport-local";
import { buildApiRouter } from "./api.js";
import tokens from "./auth/tokens.js";
import clientmanager from "./clientmanager.js";
import { initExtractor } from "./infoextractor.js";
import { getLogger, setLogLevel } from "./logger.js";
import { metricsMiddleware } from "./metrics.js";
import { loadModels, sequelize } from "./models/index.js";
import { conf, loadConfigFile, setLogger, validateConfig } from "./ott-config.js";
import { buildRateLimiter } from "./rate-limit.js";
import { buildClients, redisClient, registerRedisMetrics } from "./redisclient.js";
import roommanager from "./roommanager.js";
import { setupPostgresMetricsCollection } from "./storage.metrics.js";
import usermanager from "./usermanager.js";
import websockets from "./websockets.js";

const app = express();

export async function main() {
	const log = getLogger("app");

	setLogger(getLogger("config"));
	loadConfigFile();
	setLogLevel(conf.get("log.level"));
	if (process.argv.includes("--validate")) {
		let result = validateConfig();
		if (!result.ok) {
			log.error("Config validation failed:");
			log.error(result.value.message);
			process.exit(1);
		} else {
			log.info("Config validation passed");
			process.exit(0);
		}
	}

	const env = conf.get("env");
	const heroku = conf.get("heroku");
	const docker = conf.get("docker");
	const dbmode = conf.get("db.mode");
	log.info("Environment: " + env);
	log.info("Is Heroku? " + heroku);
	log.info("Is Docker? " + docker);
	log.info("Database mode: " + dbmode);

	const searchEnabled = conf.get("add_preview.search.enabled");
	log.info(`Search enabled: ${searchEnabled}`);

	const searchProvider = conf.get("add_preview.search.provider");
	log.info(`Search provider: ${searchProvider}`);

	const rateLimitEnabled = conf.get("rate_limit.enabled");
	log.info(`Rate limiting enabled: ${rateLimitEnabled}`);

	loadModels();
	await buildClients();
	buildRateLimiter();

	if (
		conf.get("env") === "production" &&
		conf.get("db.mode") !== "sqlite" &&
		conf.get("db.metrics")
	) {
		setupPostgresMetricsCollection(sequelize);
	}

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	app.use(metricsMiddleware);
	app.use(cookieparser(conf.get("session_secret")));

	const server = http.createServer(app);
	async function checkRedis() {
		if (performance) {
			let start = performance.now();
			await redisClient.ping();
			let duration = performance.now() - start;
			log.info(`Latency to redis: ${duration}ms`);
		}
	}
	await checkRedis();
	if (conf.get("env") !== "test" && conf.get("redis.metrics")) {
		registerRedisMetrics();
	}

	const sessionOpts: SessionOptions = {
		store: new RedisStore({ client: redisClient }),
		secret: conf.get("session_secret"),
		resave: false,
		saveUninitialized: false,
		unset: "keep",
		proxy: conf.get("env") === "production",
		cookie: {
			maxAge: 30 * 24 * 60 * 60 * 1000, // 1 month, in milliseconds
		},
	};
	if (
		conf.get("env") === "production" &&
		!!conf.get("hostname") &&
		!conf.get("hostname").includes("localhost") &&
		conf.get("trust_proxy") > 0
	) {
		log.warn(
			`Trusting ${conf.get(
				"trust_proxy"
			)} layers of reverse proxy, X-Forwarded-* headers will be trusted.`
		);
		app.set("trust proxy", conf.get("trust_proxy"));
		// @ts-expect-error
		sessionOpts.cookie.secure = true;
	}
	if (conf.get("force_insecure_cookies")) {
		log.warn("FORCE_INSECURE_COOKIES found, cookies will only be set on http, not https");
		// @ts-expect-error
		sessionOpts.cookie.secure = false;
	}
	const sessions = session(sessionOpts);

	if (fs.existsSync("../client/dist")) {
		// serve static files without creating a bunch of sessions
		app.use(
			conf.get("base_url"),
			express.static("../client/dist", {
				maxAge: "1 year",
				redirect: false,
				index: false,
			})
		);
	} else {
		log.warn("no dist folder found");
	}

	app.use(sessions);

	passport.use(new LocalStrategy({ usernameField: "user" }, usermanager.authCallback));
	passport.use(
		new DiscordStrategy(
			{
				clientID: conf.get("discord.client_id") ?? "NONE",
				clientSecret: conf.get("discord.client_secret") ?? "NONE",
				callbackURL:
					(!conf.get("hostname") || conf.get("hostname").includes("localhost")
						? "http"
						: "https") +
					`://${conf.get("hostname")}${conf.get("base_url")}/api/auth/discord/callback`,
				scope: ["identify"],
				passReqToCallback: true,
			},
			usermanager.authCallbackDiscord
		)
	);
	passport.use(
		new BearerStrategy(async (token, done) => {
			if (!(await tokens.validate(token))) {
				return done(null, false);
			}
			let ottsession = await tokens.getSessionInfo(token);
			if (ottsession.isLoggedIn) {
				return done(null, ottsession);
			}
			return done(null, false);
		})
	);
	passport.serializeUser(usermanager.serializeUser);
	passport.deserializeUser(usermanager.deserializeUser);
	app.use(passport.initialize());
	app.use(usermanager.passportErrorHandler);
	usermanager.setup();
	websockets.setup(server);
	await clientmanager.setup();
	await roommanager.start();

	app.use(bodyParser.json()); // to support JSON-encoded bodies
	app.use(
		bodyParser.urlencoded({
			// to support URL-encoded bodies
			extended: true,
		})
	);

	app.use((req, res, next) => {
		if (!req.path.startsWith("/api") || req.path.startsWith("/api/status")) {
			next();
			return;
		}
		log.info(`> ${req.method} ${req.path}`);
		log.silly(`request ip: ${req.ip} X-Forwarded-For: ${req.headers["x-forwarded-for"]}`);
		next();
	});

	function serveBuiltFiles(req, res) {
		fs.readFile("../client/dist/index.html", (err, contents) => {
			res.setHeader("Content-type", "text/html");
			if (contents) {
				res.send(contents.toString());
			} else {
				res.status(500).send("Failed to serve page, try again later.");
			}
		});
	}

	const api = buildApiRouter();
	app.use(`${conf.get("base_url")}/api`, api);
	if (fs.existsSync("../client/dist")) {
		app.get("*", serveBuiltFiles);
	} else {
		log.warn("no dist folder found, run `yarn build` to build the client");
		app.get("*", (req, res) => {
			res.status(404).send(
				"File not found - Client files not found. Run `yarn build` to build the client."
			);
		});
	}

	initExtractor();

	//start our server
	if (conf.get("env") !== "test") {
		server.listen(conf.get("port"), () => {
			let addr = server.address();
			if (!addr) {
				log.error("Failed to start server!");
				process.exit(1);
			}
			if (typeof addr === "string") {
				log.info(`Server started on ${addr}`);
			} else {
				log.info(`Server started on  ${addr.port}`);
			}
		});
	}

	return {
		app,
	};
}

async function shutdown() {
	// The order here is important. We want to get all the clients disconnected first, so they don't get the room unloaded message when all the rooms get unloaded.
	clientmanager.shutdown();
	// let the clients disconnect
	await new Promise(resolve => setTimeout(resolve, 1000));
	roommanager.shutdown();
	process.exit(0);
}

main();
