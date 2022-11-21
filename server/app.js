require("ts-node").register({
	transpileOnly: true,
});
const express = require("express");
const http = require("http");
const fs = require("fs");
const { getLogger } = require("./logger.js");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const DiscordStrategy = require("passport-discord").Strategy;
const BearerStrategy = require("passport-http-bearer").Strategy;
const { OpticMiddleware } = require("@useoptic/express-middleware");
const { metricsMiddleware } = require("./metrics");

const log = getLogger("app");

if (!process.env.NODE_ENV) {
	log.warn("NODE_ENV not set, assuming dev environment");
	process.env.NODE_ENV = "development";
}

if (process.env.NODE_ENV === "example") {
	log.error("Invalid NODE_ENV! Aborting...");
	process.exit(1);
}

require("./ott-config");

const app = express();
app.use(metricsMiddleware);
const server = http.createServer(app);

const { redisClient } = require("./redisclient");

function checkRedis() {
	let start = new Date();
	redisClient.ping(() => {
		let duration = new Date() - start;
		log.info(`Latency to redis: ${duration}ms`);
	});
}
checkRedis();

if (fs.existsSync("../client/dist")) {
	// serve static files without creating a bunch of sessions
	app.use(
		express.static(__dirname + "/../client/dist", {
			maxAge: "2 days",
			redirect: false,
			index: false,
		})
	);
} else {
	log.warn("no dist folder found");
}

const session = require("express-session");
let RedisStore = require("connect-redis")(session);
let sessionOpts = {
	store: new RedisStore({ client: redisClient }),
	secret: process.env.SESSION_SECRET || "opentogethertube",
	resave: false,
	saveUninitialized: false,
	unset: "keep",
	proxy: process.env.NODE_ENV === "production",
	cookie: {
		expires: false,
		maxAge: 30 * 24 * 60 * 60 * 1000, // 1 month, in milliseconds
	},
};
if (process.env.NODE_ENV === "production" && !process.env.OTT_HOSTNAME.includes("localhost")) {
	log.warn("Trusting proxy, X-Forwarded-* headers will be trusted.");
	app.set("trust proxy", parseInt(process.env["TRUST_PROXY"], 10) || 1);
	sessionOpts.cookie.secure = true;
}
if (process.env.FORCE_INSECURE_COOKIES) {
	log.warn("FORCE_INSECURE_COOKIES found, cookies will only be set on http, not https");
	sessionOpts.cookie.secure = false;
}
const sessions = session(sessionOpts);
app.use(sessions);

const usermanager = require("./usermanager");
passport.use(new LocalStrategy({ usernameField: "email" }, usermanager.authCallback));
passport.use(
	new DiscordStrategy(
		{
			clientID: process.env.DISCORD_CLIENT_ID || "NONE",
			clientSecret: process.env.DISCORD_CLIENT_SECRET || "NONE",
			callbackURL:
				(!process.env.OTT_HOSTNAME || process.env.OTT_HOSTNAME.includes("localhost")
					? "http"
					: "https") + `://${process.env.OTT_HOSTNAME}/api/auth/discord/callback`,
			scope: ["identify"],
			passReqToCallback: true,
		},
		usermanager.authCallbackDiscord
	)
);
const tokens = require("./auth/tokens");
passport.use(
	new BearerStrategy(async (token, done) => {
		if (!(await tokens.validate(token))) {
			return done(null, false);
		}
		let ottsession = await tokens.getSessionInfo(token);
		if (ottsession.user_id) {
			return done(null, ottsession);
		}
		return done(null, false);
	})
);
passport.serializeUser(usermanager.serializeUser);
passport.deserializeUser(usermanager.deserializeUser);
app.use(passport.initialize());
app.use(usermanager.passportErrorHandler);

const api = require("./api");

const websockets = require("./websockets.js");
websockets.Setup(server, sessions);
const clientmanager = require("./clientmanager");
clientmanager.Setup();
const roommanager = require("./roommanager");
roommanager.start();

const bodyParser = require("body-parser");
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
	bodyParser.urlencoded({
		// to support URL-encoded bodies
		extended: true,
	})
);

app.use(
	OpticMiddleware({
		enabled: process.env.NODE_ENV !== "production",
	})
);

app.use((req, res, next) => {
	if (!req.path.startsWith("/api")) {
		next();
		return;
	}
	log.info(`> ${req.method} ${req.path}`);
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

app.use("/api", api);
if (fs.existsSync("../client/dist")) {
	app.get("*", serveBuiltFiles);
} else {
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
};
