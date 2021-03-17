const URL = require("url");
const axios = require("axios");
const ServiceAdapter = require("../serviceadapter");
const Video = require("../../common/video");
const { getLogger } = require("../../logger");

const log = getLogger("reddit");

class RedditAdapter extends ServiceAdapter {
	api = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});

	get serviceId() {
		return "reddit";
	}

	canHandleURL(link) {
		const url = URL.parse(link);
		return url.host.endsWith("reddit.com") && /^\/r\/.+$/.test(url.pathname);
	}

	isCollectionURL() {
		return true;
	}

	async resolveURL(link) {
		const url = URL.parse(link);
		let subreddit = url.pathname.replace("/r/", "").replace(".json", "");
		const reqUrl = `https://reddit.com/r/${subreddit}.json?${url.query}`;
		log.info(`Requesting posts: ${reqUrl}`);
		let resp = await this.api.get(reqUrl);
		let videos = [];
		for (let post of resp.data.data.children.map(p => p.data)) {
			videos.push(new Video({
				url: post.url,
			}));
		}
		return videos;
	}
}

module.exports = RedditAdapter;
