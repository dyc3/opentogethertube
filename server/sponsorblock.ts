import { SponsorBlock, type Segment } from "sponsorblock-api";
import { redisClient } from "./redisclient";
import { v4 as uuidv4 } from "uuid";
import { ALL_SKIP_CATEGORIES } from "ott-common";
import { conf } from "./ott-config";
import { getLogger } from "./logger";

const log = getLogger("sponsorblock");

const SPONSORBLOCK_USERID_KEY = `sponsorblock-userid`;
const SEGMENT_CACHE_PREFIX = "segments";

let _cachedUserId: string | null = null;

export async function getSponsorBlockUserId(): Promise<string> {
	if (_cachedUserId) {
		return _cachedUserId;
	}
	let userid = await redisClient.get(SPONSORBLOCK_USERID_KEY);
	if (!userid) {
		userid = uuidv4();
		await redisClient.set(SPONSORBLOCK_USERID_KEY, userid);
	}
	_cachedUserId = userid;
	return userid;
}

/** Used for tests. */
export function clearUserId() {
	_cachedUserId = null;
}

export async function getSponsorBlock(): Promise<SponsorBlock> {
	const userid = await getSponsorBlockUserId();
	const sponsorblock = new SponsorBlock(userid);
	return sponsorblock;
}

export async function fetchSegments(videoId: string): Promise<Segment[]> {
	if (conf.get("video.sponsorblock.cache_ttl") > 0) {
		const cachedSegments = await redisClient.get(`${SEGMENT_CACHE_PREFIX}:${videoId}`);
		if (cachedSegments) {
			try {
				return JSON.parse(cachedSegments);
			} catch (e) {
				log.warn(
					`Failed to parse cached segments for video ${videoId}, fetching fresh segments`
				);
			}
		}
	}
	const sponsorblock = await getSponsorBlock();
	const segments = await sponsorblock.getSegments(videoId, ALL_SKIP_CATEGORIES);
	await cacheSegments(videoId, segments);
	return segments;
}

async function cacheSegments(videoId: string, segments: Segment[]) {
	await redisClient.setEx(
		`${SEGMENT_CACHE_PREFIX}:${videoId}`,
		conf.get("video.sponsorblock.cache_ttl"),
		JSON.stringify(segments)
	);
}
