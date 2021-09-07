import { URL } from "url";
import axios from "axios";
import { ServiceAdapter } from "../serviceadapter";
import { getLogger } from "../../logger";

const log = getLogger("reddit");

export default class RedditAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});

	get serviceId(): "reddit" {
		return "reddit";
	}

	canHandleURL(link: string): boolean {
		const url = new URL(link);
		return url.host.endsWith("reddit.com") && !url.pathname.includes("comments") && /^\/r\/.+$/.test(url.pathname);
	}

	isCollectionURL(link: string): boolean {
		return true;
	}

	async resolveURL(link: string): Promise<{ url: string }[]> {
		const url = new URL(link);
		if (!url.pathname.endsWith(".json")) {
			url.pathname += ".json";
		}
		log.info(`Requesting posts: ${url.toString()}`);
		const resp = await this.api.get(url.toString());
		const videos = [];
		for (const post of resp.data.data.children.map(p => p.data)) {
			videos.push({
				url: post.url,
			});
		}
		return videos;
	}
}

module.exports = RedditAdapter;
