const _ = require("lodash");
const URL = require("url");
const axios = require("axios");
const ServiceAdapter = require("../serviceadapter");
const Video = require("../../common/video");
const { getLogger } = require("../../logger");

const log = getLogger("neverthink");

class NeverthinkAdapter extends ServiceAdapter {
	api = axios.create({
		baseURL: "https://neverthink.tv/api/v5/public",
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	});
	fetch = axios.create({
		headers: {'User-Agent': `OpenTogetherTube @ ${process.env.OTT_HOSTNAME}`},
	})

	get serviceId() {
		return "neverthink";
	}

	canHandleURL(link) {
		const url = URL.parse(link);
		return url.host.endsWith("neverthink.tv") && url.pathname.length > 1;
	}

	isCollectionURL(link) {
		const url = URL.parse(link);
		return !url.pathname.startsWith("/v/");
	}

	getVideoId(link) {
		const url = URL.parse(link);
		return url.pathname.replace("/v/", "");
	}

	async fetchVideoInfo(id) {
		let resp = await this.api.get(`/videos/${id}`);
		return this.parseVideo(resp.data);
	}

	async resolveURL(link) {
		const url = URL.parse(link);
		if (url.pathname.startsWith("/v/")) {
			const id = this.getVideoId(link);
			return await this.fetchVideoInfo(id);
		}
		else if (url.pathname.startsWith("/u/")) {
			let user = url.pathname.replace("/u/", "");
			return await this.getUserChannel(user);
		}
		else if (url.pathname.startsWith("/playlists/")) {
			let resp = await this.fetch.get(link);
			// HACK: limit the possible array size to 50, because you can't request more than 50 videos at a time from youtube
			return resp.data.videos.slice(0, 50).map(vid => {
				if (vid.startsWith("nt:")) {
					let ytid = vid.split(":")[2];
					return new Video({
						service: "youtube",
						id: ytid,
					});
				}
				else if (vid.startsWith("vimeo:")) {
					let vimeoid = vid.split(":")[1];
					return new Video({
						service: "vimeo",
						id: vimeoid,
					});
				}
				else {
					return new Video({
						service: "youtube",
						id: vid,
					});
				}
			});
		}
		else {
			let channels = await this.getAllChannels();
			let playlistUrl = _.find(channels, { urlFragment: url.pathname.split("/").slice(-1)[0] }).playlist.urlPlain;
			log.info(`found playlist URL: ${playlistUrl}`);
			return await this.resolveURL(playlistUrl);
		}
	}

	parseVideo(data) {
		let sid;
		if (data.origin === "yt") {
			log.info("found youtube origin at neverthink link");
			sid = {
				service: "youtube",
				id: data.id,
			};
		}
		else if (data.origin === "nt") {
			log.info("found neverthink origin at neverthink link, but it links back to a youtube video");
			sid = {
				service: "youtube",
				id: data.originalVideoId,
			};
		}
		return new Video({
			...sid,
			title: data.title,
			description: data.description,
			length: data.duration,
			thumbnail: data.thumbnailUrl,
		});
	}

	/**
	 * Get videos from a neverthink user's channel.
	 * @param {string} user
	 */
	async getUserChannel(user) {
		let resp = await this.api.get(`/users/${user}?include=videos`);
		return resp.data.videos.slice(0, 50).map(this.parseVideo);
	}

	async getAllChannels() {
		let resp = await this.api.get("/init");
		return resp.data.channels;
	}
}

module.exports = NeverthinkAdapter;
