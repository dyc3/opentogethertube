import express from "express";
import http from "http";
import fs from "fs";
import { getLogger } from "./logger.js";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as DiscordStrategy } from "passport-discord";
import { Strategy as BearerStrategy } from "passport-http-bearer";
import { metricsMiddleware } from "./metrics";

const log = getLogger("app");

if (!process.env.NODE_ENV) {
	log.warn("NODE_ENV not set, assuming dev environment");
	process.env.NODE_ENV = "development";
}

if (process.env.NODE_ENV === "example") {
	log.error("Invalid NODE_ENV! Aborting...");
	process.exit(1);
}

import "./ott-config";

const app = express();
app.use(metricsMiddleware);
const server = http.createServer(app);

import { redisClient } from "./redisclient";

function checkRedis() {
	let start = performance.now();
	redisClient.ping(() => {
		let duration = performance.now() - start;
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

import session from "express-session";
import connectRedis from "connect-redis";
let RedisStore = connectRedis(session);
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
if (
	process.env.NODE_ENV === "production" &&
	process.env.OTT_HOSTNAME &&
	!process.env.OTT_HOSTNAME.includes("localhost")
) {
	log.warn("Trusting proxy, X-Forwarded-* headers will be trusted.");
	app.set("trust proxy", parseInt(process.env["TRUST_PROXY"] ?? "1", 10) || 1);
	// @ts-expect-error
	sessionOpts.cookie.secure = true;
}
if (process.env.FORCE_INSECURE_COOKIES) {
	log.warn("FORCE_INSECURE_COOKIES found, cookies will only be set on http, not https");
	// @ts-expect-error
	sessionOpts.cookie.secure = false;
}
// @ts-expect-error im too lazy to fix this right now
const sessions = session(sessionOpts);
app.use(sessions);

import usermanager from "./usermanager";
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
import tokens from "./auth/tokens";
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
import websockets from "./websockets.js";
websockets.Setup(server, sessions);
import clientmanager from "./clientmanager";
clientmanager.Setup();
import roommanager from "./roommanager";
roommanager.start();

import bodyParser from "body-parser";
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
	bodyParser.urlencoded({
		// to support URL-encoded bodies
		extended: true,
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

import api from "./api";
app.use("/api", api);
if (fs.existsSync("../client/dist")) {
	app.get("*", serveBuiltFiles);
} else {
	log.warn("no dist folder found");
}

//start our server
if (process.env.NODE_ENV !== "test") {
	server.listen(process.env.PORT || 3000, () => {
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

module.exports = {
	app,
	redisClient,
	server,
};

export default {
	app,
	redisClient,
	server,
};
