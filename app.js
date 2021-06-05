require('ts-node').register();
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { uniqueNamesGenerator } = require('unique-names-generator');
const { getLogger, setLogLevel } = require('./logger.js');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const validator = require('validator');

const log = getLogger("app");

if (!process.env.NODE_ENV) {
	log.warn("NODE_ENV not set, assuming dev environment");
	process.env.NODE_ENV = "development";
}

if (process.env.NODE_ENV === "example") {
	log.error("Invalid NODE_ENV! Aborting...");
	process.exit(1);
}

const config_path = path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`);
log.info(`Reading config from ${process.env.NODE_ENV}.env`);
if (!fs.existsSync(config_path)) {
	log.error(`No config found! Things will break! ${config_path}`);
}
require('dotenv').config({ path: config_path });

const isOfficial = process.env.OTT_HOSTNAME === "opentogethertube.com";

// configuration validation
// key: config variable
// value: object:
//   required: bool Indicates whether or not this variable is required to function.
//   validator: function that returns true if the value is valid
const configValidators = {
	OTT_HOSTNAME: { required: process.env.NODE_ENV === "production", validator: (value) => validator.isIP(value) || validator.isURL(value, { disallow_auth: true }) || value.includes("localhost") },
	DISCORD_CLIENT_ID: { required: process.env.NODE_ENV === "production" && isOfficial, validator: (value) => !isOfficial || (value.length >= 18 && validator.isNumeric(value, { no_symbols: true })) },
	DISCORD_CLIENT_SECRET: { required: process.env.NODE_ENV === "production" && isOfficial, validator: (value) => !isOfficial || value.length >= 32 },
	OPENTOGETHERTUBE_API_KEY: { required: false, validator: (value) => process.env.NODE_ENV !== "production" || (value !== "GENERATE_YOUR_OWN_API_KEY" && value.length >= 40) },
	SESSION_SECRET: { required: process.env.NODE_ENV === "production", validator: (value) => process.env.NODE_ENV !== "production" || !isOfficial || (value !== "GENERATE_YOUR_OWN_SECRET" && value.length >= 80) },
	// eslint-disable-next-line array-bracket-newline
	LOG_LEVEL: { required: false, validator: (value) => ["silly", "debug", "info", "warn", "error"].includes(value) },
	YOUTUBE_API_KEY: { required: process.env.NODE_ENV === "production", validator: (value) => process.env.NODE_ENV !== "production" || value !== "API_KEY_GOES_HERE" },
	DB_MODE: { required: false, validator: value => !value || ["sqlite", "postgres"].includes(value) },
	ADD_PREVIEW_SEARCH_MIN_LENGTH: { required: false, validator: value => !value || validator.isNumeric(value, { no_symbols: true }) },
	ENABLE_SEARCH: { required: false, validator: value => !value || ["true", "false"].includes(value) },
	// TODO: check which info extractors implement searching videos
	// eslint-disable-next-line array-bracket-newline
	SEARCH_PROVIDER: { required: false, validator: value => !value || ["youtube"].includes(value) },
	ADD_PREVIEW_PLAYLIST_RESULTS_COUNT: { required: false, validator: value => !value || validator.isNumeric(value, { no_symbols: true }) },
	ADD_PREVIEW_SEARCH_RESULTS_COUNT: { required: false, validator: value => !value || validator.isNumeric(value, { no_symbols: true }) },
};

let configCalidationFailed = false;
for (let configVar in configValidators) {
	const rules = configValidators[configVar];
	if (rules.required && !process.env[configVar]) {
		log.error(`${configVar} is required, but it was not found.`);
		configCalidationFailed = true;
	}
	else if (process.env[configVar] && !rules.validator(process.env[configVar])) {
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
	process.env.DB_MODE = (process.env.DATABASE_URL || process.env.POSTGRES_DB_HOST || process.env.POSTGRES_DB_NAME || process.env.POSTGRES_DB_USERNAME || process.env.POSTGRES_DB_PASSWORD) ? "postgres" : "sqlite";
}
log.info(`Database mode: ${process.env.DB_MODE}`);

if (process.env.ENABLE_SEARCH === undefined) {
	process.env.ENABLE_SEARCH = true;
}
log.info(`Search enabled: ${process.env.ENABLE_SEARCH}`);

if (!process.env.SEARCH_PROVIDER) {
	process.env.SEARCH_PROVIDER = "youtube";
}
log.info(`Search provider: ${process.env.SEARCH_PROVIDER}`);

const app = express();
const server = http.createServer(app);

const { redisClient } = require('./redisclient');

function checkRedis() {
	let start = new Date();
	redisClient.ping(() => {
		let duration = new Date() - start;
		log.info(`Latency to redis: ${duration}ms`);
	});
}
checkRedis();

if (fs.existsSync("./dist")) {
	// serve static files without creating a bunch of sessions
	app.use(express.static(__dirname + "/dist", {
		maxAge: "2 days",
		redirect: false,
		index: false,
	}));
}
else {
	log.warn("no dist folder found");
}

const session = require('express-session');
let RedisStore = require('connect-redis')(session);
let sessionOpts = {
	store: new RedisStore({ client: redisClient }),
	secret: process.env.SESSION_SECRET || "opentogethertube",
	resave: false,
	saveUninitialized: true,
	unset: 'keep',
	proxy: process.env.NODE_ENV === "production",
	cookie: {
		expires: false,
		maxAge: 30 * 24 * 60 * 60 * 1000, // 1 month, in milliseconds
	},
};
if (process.env.NODE_ENV === "production" && !process.env.OTT_HOSTNAME.includes("localhost")) {
	log.warn("Trusting proxy, X-Forwarded-* headers will be trusted.");
	app.set('trust proxy', parseInt(process.env["TRUST_PROXY"], 10) || 1);
	sessionOpts.cookie.secure = true;
}
if (process.env.FORCE_INSECURE_COOKIES) {
	log.warn("FORCE_INSECURE_COOKIES found, cookies will only be set on http, not https");
	sessionOpts.cookie.secure = false;
}
const sessions = session(sessionOpts);
app.use(sessions);

const usermanager = require("./usermanager");
passport.use(new LocalStrategy({ usernameField: 'email' }, usermanager.authCallback));
passport.use(new DiscordStrategy({
	clientID: process.env.DISCORD_CLIENT_ID || "NONE",
	clientSecret: process.env.DISCORD_CLIENT_SECRET || "NONE",
	callbackURL: (!process.env.OTT_HOSTNAME || process.env.OTT_HOSTNAME.includes("localhost") ? "http" : "https") + `://${process.env.OTT_HOSTNAME}/api/user/auth/discord/callback`,
	scope: ["identify"],
	passReqToCallback: true,
}, usermanager.authCallbackDiscord));
const tokens = require("./server/auth/tokens");
passport.use(new BearerStrategy((token, done) => {
	if (!tokens.validate(token)) {
		return done(null, false);
	}
	return done(null, tokens.getSessionInfo(token));
}));
passport.serializeUser(usermanager.serializeUser);
passport.deserializeUser(usermanager.deserializeUser);
app.use(passport.initialize());
app.use(passport.session());
app.use(usermanager.passportErrorHandler);

app.use((req, res, next) => {
	if (!req.user && !req.session.username) {
		let username = uniqueNamesGenerator();
		log.debug(`Generated name for new user (on request): ${username}`);
		log.debug(`headers: x-forwarded-proto=${req.headers["x-forwarded-proto"]} x-forwarded-for=${req.headers["x-forwarded-for"]} x-forwarded-host=${req.headers["x-forwarded-host"]}`);
		if (req.protocol === "http" && sessionOpts.cookie.secure) {
			log.error(`found protocol ${req.protocol} and secure cookies. cookies will not be set`);
		}
		req.session.username = username;
		req.session.save((err) => {
			if (err) {
				log.error(`Failed to save session: ${err}`);
			}
			else {
				log.silly("Session saved.");
			}
		});
	}
	else {
		log.debug("User is logged in, skipping username generation");
	}

	next();
});

const api = require("./api");

const websockets = require("./server/websockets.js");
websockets.Setup(server, sessions);
const clientmanager = require("./server/clientmanager.ts");
clientmanager.Setup();
const roommanager = require("./server/roommanager");
roommanager.start();

const bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true,
}));

app.use((req, res, next) => {
	if (!req.path.startsWith("/api")) {
		next();
		return;
	}
	log.info(`> ${req.method} ${req.path}`);
	next();
});

function serveBuiltFiles(req, res) {
	fs.readFile("dist/index.html", (err, contents) => {
		res.setHeader("Content-type", "text/html");
		if (contents) {
			res.send(contents.toString());
		}
		else {
			res.status(500).send("Failed to serve page, try again later.");
		}
	});
}

app.use("/api", api);
if (fs.existsSync("./dist")) {
	app.get("*", serveBuiltFiles);
}
else {
	log.warn("no dist folder found");
}

//start our server
if (process.env.NODE_ENV !== "test") {
	server.listen(process.env.PORT || 3000, () => {
		log.info(`Server started on port ${server.address().port}`);
	});
}

module.exports = {
	app,
	redisClient,
	server,
	configValidators,
};
