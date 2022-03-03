import crypto from "crypto";
import { redisClientAsync } from "../redisclient";
import { AuthToken } from "../../common/models/types";

const PREFIX = "auth";
const EXPIRATION_TIME = 14 * 24 * 60 * 60; // 14 days in seconds
const EXPIRATION_TIME_LOGGED_IN = 120 * 24 * 60 * 60 * 2; // 120 days in seconds

export type SessionInfo =
	| { isLoggedIn: false; username: string }
	| { isLoggedIn: true; user_id: number };

export async function validate(token: AuthToken): Promise<boolean> {
	return (await redisClientAsync.exists(`${PREFIX}:${token}`)) > 0;
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
	const info = JSON.parse(await redisClientAsync.get(`${PREFIX}:${token}`));
	return info;
}

export async function setSessionInfo(token: AuthToken, session: SessionInfo): Promise<void> {
	const expiration = session.isLoggedIn ? EXPIRATION_TIME_LOGGED_IN : EXPIRATION_TIME;
	await redisClientAsync.set(`${PREFIX}:${token}`, JSON.stringify(session), "EX", expiration);
}

module.exports = {
	validate,
	mint,
	getSessionInfo,
	setSessionInfo,
};
export default module.exports;
