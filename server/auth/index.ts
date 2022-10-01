import { getLogger } from "../logger.js";
import express from "express";
import tokens, { SessionInfo } from "./tokens";
import { uniqueNamesGenerator } from "unique-names-generator";
import passport from "passport";
import { AuthToken, MySession } from "../../common/models/types";
import nocache from "nocache";
import usermanager from "../usermanager";
import { OttException } from "../../common/exceptions";

const router = express.Router();
router.use(nocache());
const log = getLogger("api/auth");

function createSession(): SessionInfo {
	return {
		isLoggedIn: false,
		username: uniqueNamesGenerator(),
	};
}

function checkApiKey(input: string) {
	if (!process.env.OPENTOGETHERTUBE_API_KEY) {
		throw new OttException("apikey is not set");
	}
	if (input !== process.env.OPENTOGETHERTUBE_API_KEY) {
		throw new OttException("apikey is invalid");
	}
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
			checkApiKey(apikey);
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
	}

	if (!(await tokens.validate(req.token))) {
		res.status(400).json({
			success: false,
			error: {
				name: "MissingToken",
				message: "Missing auth token. Get a token from /api/auth/grant first.",
			},
		});
		return;
	}

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	(req.session as MySession).token = req.token;
	req.ottsession = await tokens.getSessionInfo(req.token);
	if (req.ottsession && req.ottsession.isLoggedIn) {
		req.user = await usermanager.getUser({ id: req.ottsession.user_id });
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
				res.json({
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
	res.json({
		token,
	});
});

router.get("/discord", passport.authenticate("discord"));
router.get(
	"/discord/callback",
	passport.authenticate("discord", {
		failureRedirect: "/",
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
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
		await tokens.setSessionInfo((req.session as MySession).token, {
			isLoggedIn: true,
			user_id: req.user.id,
		});
		log.info(`${req.user.username} logged in via social login.`);
		res.redirect("/"); // Successful auth
	}
);

export default {
	router,
	authTokenMiddleware,
};
