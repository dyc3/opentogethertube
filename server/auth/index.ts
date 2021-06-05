import { getLogger } from '../../logger.js';
import express from "express";
import tokens, { AuthToken, SessionInfo } from './tokens';
import { uniqueNamesGenerator } from 'unique-names-generator';

const router = express.Router();
const log = getLogger("api/auth");

function createSession(): SessionInfo {
	return {
		username: uniqueNamesGenerator(),
	};
}

export async function authTokenMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
	log.silly("validating auth token");
	const token: AuthToken = req.headers.authorization.split(" ")[1];
	req.authInfo = {
		token,
	};
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	if (!await tokens.validate(req.authInfo.token)) {
		res.json({
			success: false,
			error: {
				name: "MissingToken",
				message: "Missing auth token. Get a token from /api/auth/grant first.",
			},
		});
		return;
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	req.auth = await tokens.getSessionInfo(req.authInfo.token);
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

export default {
	router,
	authTokenMiddleware,
};
