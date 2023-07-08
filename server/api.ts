import express from "express";
import { getLogger } from "./logger.js";
import roomapi from "./api/room";
import auth from "./auth";
import usermanager from "./usermanager";
import passport from "passport";
import statusapi from "./api/status";
import { conf } from "./ott-config";
import announceapi from "./api/announce";
import dataapi from "./api/data";
import { Counter } from "prom-client";
import { redisClient } from "./redisclient";
import session, { SessionOptions } from "express-session";
import connectRedis from "connect-redis";

const log = getLogger("api");
export function buildApiRouter(app: express.Express): express.Router {
	const RedisStore = connectRedis(session);
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
		!conf.get("hostname").includes("localhost")
	) {
		log.warn("Trusting proxy, X-Forwarded-* headers will be trusted.");
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
	const router = express.Router();

	router.use("/auth", auth.router);
	router.use("/status", statusapi);
	router.use(sessions);

	router.use((req, res, next) => {
		// eslint-disable-next-line no-unused-vars
		passport.authenticate("bearer", (err, user, info) => {
			// We are intentionally ignoring the case where authentication fails, because
			// we want to allow users who are not logged in to an actual account to
			// be able to use the website.

			// log.error(`bearer auth error: ${err}`);
			if (err) {
				next(err);
				return;
			}
			// log.debug(`bearer auth user: ${user}`);
			// log.debug(`bearer auth info: ${info}`);
			next();
		})(req, res, next);
	});
	router.use(auth.authTokenMiddleware);
	router.use("/user", usermanager.router);
	router.use("/room", roomapi);
	router.use("/announce", announceapi);
	router.use("/data", dataapi);

	if (conf.get("env") === "development") {
		(async () => {
			router.use("/dev", (await import("./api/dev")).default);
		})();
	}

	return router;
}
