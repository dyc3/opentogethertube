import crypto from "crypto";
import { redisClient, redisClient } from "../redisclient";
import { AuthToken } from "../../common/models/types";

const PREFIX = "auth";
const EXPIRATION_TIME = 14 * 24 * 60 * 60; // 14 days in seconds
const EXPIRATION_TIME_LOGGED_IN = 120 * 24 * 60 * 60 * 2; // 120 days in seconds

export type SessionInfo =
	| { isLoggedIn: false; username: string }
	| { isLoggedIn: true; user_id: number };

export async function validate(token: AuthToken): Promise<boolean> {
	return (await redisClient.exists(`${PREFIX}:${token}`)) > 0;
}

/**
 * Mint a new crypto-random auth token so it can be assigned session information.
 */
export async function mint(): Promise<AuthToken> {
	const buffer = crypto.randomBytes(512);
	const token: AuthToken = buffer.toString("base64");
	return token;
}

export async function getSessionInfo(token: AuthToken): Promise<SessionInfo> {
	const text = await redisClient.get(`${PREFIX}:${token}`);
	if (!text) {
		throw new Error(`No session info found`);
	}
	const info = JSON.parse(text);
	return info;
}

export async function setSessionInfo(token: AuthToken, session: SessionInfo): Promise<void> {
	const expiration = session.isLoggedIn ? EXPIRATION_TIME_LOGGED_IN : EXPIRATION_TIME;
	await redisClient.setEx(`${PREFIX}:${token}`, expiration, JSON.stringify(session));
}

export default {
	validate,
	mint,
	getSessionInfo,
	setSessionInfo,
};
