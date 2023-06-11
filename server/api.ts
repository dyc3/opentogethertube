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

const log = getLogger("api");

const router = express.Router();

router.use("/auth", auth.router);
router.use("/status", statusapi);
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

export default router;
