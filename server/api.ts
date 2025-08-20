import express from "express";
import passport from "passport";
import announceapi from "./api/announce.js";
import dataapi from "./api/data.js";
import roomapi from "./api/room.js";
import statusapi from "./api/status.js";
import userapi from "./api/user.js";
import auth from "./auth/index.js";
import { getLogger } from "./logger.js";
import { conf } from "./ott-config.js";
import usermanager from "./usermanager.js";

const log = getLogger("api");
export function buildApiRouter(): express.Router {
	log.debug("Building API router");
	const router = express.Router();

	router.use("/status", statusapi);
	router.use("/auth", auth.router);
	router.use("/data", dataapi);

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
	router.use("/user", userapi);
	router.use("/room", roomapi);
	router.use("/announce", announceapi);

	if (conf.get("env") === "development") {
		(async () => {
			router.use("/dev", (await import("./api/dev.js")).default);
		})();
	}

	return router;
}
