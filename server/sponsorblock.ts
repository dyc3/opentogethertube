import { SponsorBlock } from 'sponsorblock-api';
import { redisClientAsync } from './redisclient';
import uuid from 'uuid';

const SPONSORBLOCK_USERID_KEY = `sponsorblock-userid`;

export async function getSponsorBlockUserId(): Promise<string> {
	let userid = await redisClientAsync.get(SPONSORBLOCK_USERID_KEY);
	if (!userid) {
		userid = uuid.v4();
		await redisClientAsync.set(SPONSORBLOCK_USERID_KEY, userid);
	}
	return userid;
}

export async function getSponsorBlock(): Promise<SponsorBlock> {
	const userid = await getSponsorBlockUserId();
	const sponsorblock = new SponsorBlock(userid);
	return sponsorblock;
}
