import { getLogger } from '../../logger.js';
import express from "express";
import tokens, { SessionInfo } from './tokens';
import { uniqueNamesGenerator } from 'unique-names-generator';
import passport from "passport";
import { User } from "../../models/user";
import { AuthToken } from "../../common/models/types";

const router = express.Router();
const log = getLogger("api/auth");

declare module "express" {
	export interface Request {
		token?: AuthToken;
		ottsession?: SessionInfo;
		user?: User
	}
}

function createSession(): SessionInfo {
	return {
		username: uniqueNamesGenerator(),
	};
}

export async function authTokenMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
	log.silly("validating auth token");
	if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
		const token: AuthToken = req.headers.authorization.split(" ")[1];
		req.token = token;
	}

	if (!await tokens.validate(req.token)) {
		res.json({
			success: false,
			error: {
				name: "MissingToken",
				message: "Missing auth token. Get a token from /api/auth/grant first.",
			},
		});
		return;
	}

	req.ottsession = await tokens.getSessionInfo(req.token);
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
			}
			else {
				log.debug("token invalid");
			}
		}
		else {
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

router.get('/discord', passport.authenticate('discord'));
router.get('/discord/callback', passport.authenticate('discord', {
	failureRedirect: '/',
}), (req: express.Request, res) => {
	log.info(`${req.user.username} logged in via social login.`);
	res.redirect('/'); // Successful auth
});

export default {
	router,
	authTokenMiddleware,
};
