import crypto from 'crypto';
import { redisClientAsync } from "../../redisclient";
// import usermanager from '../../usermanager';

const PREFIX = "auth";
const EXPIRATION_TIME = 90 * 24 * 60 * 60; // 3 months, in seconds

export type AuthToken = string
export type SessionInfo = { username: string } | { user_id: number }

export async function validate(token: AuthToken): Promise<boolean> {
	return await redisClientAsync.exists(`${PREFIX}:${token}`) > 0;
}

/**
 * Mint a new crypto-random auth token so it can be assigned session information.
 */
export async function mint(): Promise<AuthToken> {
	const buffer = crypto.randomBytes(512);
	const token: AuthToken = buffer.toString('base64');
	return token;
}

export async function getSessionInfo(token: AuthToken): Promise<SessionInfo> {
	const info = JSON.parse(await redisClientAsync.get(`${PREFIX}:${token}`));
	return info;
}

export async function setSessionInfo(token: AuthToken, session: SessionInfo): Promise<void> {
	await redisClientAsync.set(`${PREFIX}:${token}`, JSON.stringify(session), "EX", EXPIRATION_TIME);
}

module.exports = {
	validate,
	mint,
	getSessionInfo,
	setSessionInfo,
};
export default module.exports;
