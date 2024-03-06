import crypto from "crypto";
import { redisClient } from "../redisclient";
import { AuthToken } from "ott-common/models/types";
import jwt from "jsonwebtoken";
import { conf } from "../ott-config";
import { createSession } from ".";
import { getLogger } from "../logger";

const log = getLogger("auth/tokens");

const PREFIX = "auth";
const EXPIRATION_TIME = "14d";
const EXPIRATION_TIME_LOGGED_IN = 120 * 24 * 60 * 60 * 2; // 120 days in seconds

export type SessionInfo =
	| { isLoggedIn: false; username: string }
	| { isLoggedIn: true; user_id: number };

export async function validate(token: AuthToken): Promise<boolean> {
	// return (await redisClient.exists(`${PREFIX}:${token}`)) > 0;
	try {
		jwt.verify(token, conf.get("session_secret"));
		return true;
	} catch (err) {
		log.error("Failed to validate token", err);
		return false;
	}
}

/**
 * Mint a new crypto-random auth token so it can be assigned session information.
 */
export async function mint(): Promise<AuthToken> {
	// const buffer = crypto.randomBytes(512);
	// const token: AuthToken = buffer.toString("base64");
	const token: AuthToken = jwt.sign(createSession(), conf.get("session_secret"), {
		expiresIn: EXPIRATION_TIME,
	});
	return token;
}

export async function getSessionInfo(token: AuthToken): Promise<SessionInfo> {
	const decoded = jwt.verify(token, conf.get("session_secret"));
	if (!decoded) {
		throw new Error(`No session info found`);
	}
	return decoded as SessionInfo;
	// const text = await redisClient.get(`${PREFIX}:${token}`);
	// if (!text) {
	// 	throw new Error(`No session info found`);
	// }
	// const info = JSON.parse(text);
	// return info;
}

/** @deprecated This will no longer work because auth tokens are JWTs now. */
export async function setSessionInfo(token: AuthToken, session: SessionInfo): Promise<void> {
	// const expiration = session.isLoggedIn ? EXPIRATION_TIME_LOGGED_IN : EXPIRATION_TIME;
	// await redisClient.setEx(`${PREFIX}:${token}`, expiration, JSON.stringify(session));
	log.warn(
		"setSessionInfo is deprecated and will no longer work because auth tokens are JWTs now."
	);
}

export default {
	validate,
	mint,
	getSessionInfo,
	setSessionInfo,
};
