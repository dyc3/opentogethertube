import { URL } from "url";
import axios from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { getLogger } from "../../logger";
import { Video } from "../../common/models/video";
import e from "express";

const log = getLogger("reddit");

export interface RedditListing<T> {
	kind: "Listing",
	data: {
		modhash: string,
		children: T[],
	},
}

export interface RedditPost {
	kind: "t3",
	data: RedditPostData | RedditVideoPostData,
}

export interface RedditPostData {
	subreddit: string,
	title: string,
	selftext: string,
	is_video: boolean,
	permalink: string,
	url: string,
	thumbnail: string,
}

export interface RedditVideoPostData extends RedditPostData {
	is_video: true,
	is_reddit_media_domain: boolean,
	media: RedditMedia,
	secure_media: RedditMedia,
}

export interface RedditMedia {
	reddit_video: {
		hls_url: string,
		dash_url: string,
		duration: number,
		height: number,
		width: number,
		fallback_url: string,
		transcoding_status: string,
		is_gif: boolean,
		scrubber_media_url: string,
	}
}

export interface RedditComment {
	kind: "t1",
	data: {
		body: string,
	}
}

export type RedditListableThing = RedditPost | RedditComment;
export type RedditThing = RedditPost | RedditComment | RedditListing<RedditListableThing>;

export default class RedditAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});

	get serviceId(): "reddit" {
		return "reddit";
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		return url.host.endsWith("reddit.com") && /^\/r\/.+$/.test(url.pathname);
	}

	isCollectionURL(link: string): boolean {
		return true;
	}

	async resolveURL(link: string): Promise<(Video | { url: string })[]> {
		const url = new URL(link);
		if (!url.pathname.endsWith(".json")) {
			url.pathname += ".json";
		}
		log.info(`Requesting posts: ${url.toString()}`);
		const resp = await this.fetchRedditUrl(url.toString());
		const fetchResult = Array.isArray(resp) ? resp : [resp];
		const videos = this.extractVideos(fetchResult[0]);

		return videos;
	}

	async fetchRedditUrl(link: string): Promise<RedditListing<RedditListableThing>[] | RedditListing<RedditListableThing>> {
		let resp = await this.api.get(link);
		if (Array.isArray(resp.data)) {
			return resp.data as RedditListing<RedditListableThing>[];
		}
		return resp.data as RedditListing<RedditListableThing>;
	}

	public extractVideos(thing: RedditThing): (Video | { url: string })[] {
		const videos: (Video | { url: string })[] = [];
		if (thing.kind === "Listing") {
			for (const listedThing of thing.data.children) {
				videos.push(...this.extractVideos(listedThing));
			}
		}
		else if (thing.kind === "t3") {
			if (thing.data.is_video && "media" in thing.data) {
				videos.push({
					service: "direct",
					id: thing.data.media.reddit_video.hls_url,
					title: thing.data.title,
					description: thing.data.permalink,
					length: thing.data.media.reddit_video.duration,
					thumbnail: thing.data.thumbnail,
				});
			}
			else {
				if (thing.data.url.length > 0) {
					videos.push({
						url: thing.data.url,
					});
				}
			}
		}
		return videos;
	}
}

module.exports = RedditAdapter;
