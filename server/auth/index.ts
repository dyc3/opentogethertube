import { getLogger } from "../logger";
import express from "express";
import tokens, { SessionInfo } from "./tokens";
import { uniqueNamesGenerator } from "unique-names-generator";
import passport from "passport";
import { AuthToken, MySession } from "ott-common/models/types";
import nocache from "nocache";
import usermanager from "../usermanager";
import { OttException } from "ott-common/exceptions";
import { requireApiKey } from "../admin";
import { conf } from "../ott-config";

const router = express.Router();
router.use(nocache());
const log = getLogger("api/auth");

function createSession(): SessionInfo {
	return {
		isLoggedIn: false,
		username: uniqueNamesGenerator(),
	};
}

export async function authTokenMiddleware(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
): Promise<void> {
	let apikey = req.get("apikey");
	if (apikey) {
		log.silly("API key was provided for auth");
		try {
			requireApiKey(apikey);
		} catch (err) {
			if (err instanceof Error) {
				res.status(400).json({
					success: false,
					error: {
						name: err.name,
						message: err.message,
					},
				});
			} else {
				res.status(400).json({
					success: false,
				});
			}
			return;
		}
		next();
		return;
	}
	log.silly("validating auth token");
	if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
		const token: AuthToken = req.headers.authorization.split(" ")[1];
		req.token = token;
	} else if (req.cookies?.token) {
		req.token = req.cookies.token;
	}

	if (!req.token) {
		res.status(400).json({
			success: false,
			error: {
				name: "MissingToken",
				message: "Missing auth token. Get a token from /api/auth/grant first.",
			},
		});
		return;
	}

	try {
		req.ottsession = await tokens.getSessionInfo(req.token);
	} catch (err) {
		log.warn(`Error getting session info in auth middleware: ${err}`);
	}
	if (!req.ottsession) {
		res.status(401).json({
			success: false,
			error: {
				name: "MissingToken",
				message: "Missing valid auth token. Get a token from /api/auth/grant first.",
			},
		});
		return;
	}
	if (req.ottsession && req.ottsession.isLoggedIn) {
		try {
			req.user = await usermanager.getUser({ id: req.ottsession.user_id });
		} catch (err) {
			log.warn(`Error getting user in auth middleware, logging out: ${err}`);
			await tokens.setSessionInfo(req.token, createSession());
		}
	}
	next();
}

router.get("/grant", async (req, res) => {
	if (req.headers.authorization) {
		log.debug("authorization header found");
		if (req.headers.authorization.startsWith("Bearer")) {
			const token: AuthToken = req.headers.authorization.split(" ")[1];
			if (await tokens.validate(token)) {
				log.debug("token is already valid");
				res.cookie("token", token, {
					httpOnly: true,
					sameSite: "lax",
					secure: !conf.get("force_insecure_cookies"),
				}).json({
					token,
				});
				return;
			} else {
				log.debug("token invalid");
			}
		} else {
			log.debug(`authorization header incorrect format: ${req.headers.authorization}`);
		}
	}
	log.debug("minting new auth token...");
	const token: AuthToken = await tokens.mint();
	await tokens.setSessionInfo(token, createSession());
	res.cookie("token", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: !conf.get("force_insecure_cookies"),
	}).json({
		token,
	});
});

router.get(
	"/discord",
	async (req, res, next) => {
		// @ts-expect-error ts really doesn't like express's query type
		(req.session as MySession).postLoginRedirect = req.query.redirect ?? "/";
		next();
	},
	passport.authenticate("discord", { keepSessionInfo: true })
);
router.get(
	"/discord/callback",
	passport.authenticate("discord", {
		failureRedirect: "/",
		keepSessionInfo: true,
	}),
	async (_req, res) => {
		const req = _req as express.Request;
		if (!req.user) {
			res.status(400).json({
				success: false,
				error: {
					message: "no user found on request",
				},
			});
			return;
		}
		const token = req.cookies?.token;
		if (!token) {
			res.status(400).json({
				success: false,
				error: {
					message: "no token found on request",
				},
			});
			return;
		}

		await tokens.setSessionInfo(token, {
			isLoggedIn: true,
			user_id: req.user.id,
		});
		log.info(`${req.user.username} logged in via social login.`);
		const redirect = (req.session as MySession).postLoginRedirect ?? "/";
		log.debug(`redirecting to ${redirect}`);
		res.redirect(redirect); // Successful auth
		delete (req.session as MySession).postLoginRedirect;
	}
);

export default {
	router,
	authTokenMiddleware,
};
