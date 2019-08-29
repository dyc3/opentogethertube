const axios = require("axios");
const url = require("url");
const querystring = require('querystring');

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL
});

module.exports = {
	getService(link) {
		let srcUrl = url.parse(link);
		if (srcUrl.host.endsWith("youtube.com") || srcUrl.host.endsWith("youtu.be")) {
			return "youtube";
		}
		else {
			return false;
		}
	},

	getVideoIdYoutube(link) {
		let urlParsed = url.parse(link);
		if (urlParsed.host.endsWith("youtu.be")) {
			return urlParsed.path.replace("/", "");
		}
		else {
			return querystring.parse(urlParsed.query)["v"];
		}
	},

	getVideoInfoYoutube(ids) {
		// TODO: local caching of results
		if (!Array.isArray(ids)) {
			throw "`ids` must be an array on video IDs.";
		}
		return new Promise((resolve, reject) => {
			YtApi.get(`/videos?key=${process.env.YOUTUBE_API_KEY}&part=snippet,contentDetails&id=${ids.join(",")}`).then(res => {
				if (res.status !== 200) {
					reject(`Failed with status code ${res.status}`);
					return;
				}

				let results = {};
				for (let i = 0; i < res.data.items.length; i++) {
					let item = res.data.items[i];
					results[item.id] = item;
				}
				resolve(results);
			}).catch(err => {
				reject(err);
			});
		});
	},

	getVideoLengthYoutube_Fallback: async (url) => {
		let res = await axios.get(url);
		let regexs = [/length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/];
		for (let r = 0; r < regexs.length; r++) {
			let matches = res.data.match(regexs[r]);
			if (matches == null) {
				continue;
			}
			for (let m = 0; m < matches.length; m++) {
				const match = matches[m];
				let extracted = match.split(":")[1].substring(r == 0 ? 1 : 2);
				console.log("MATCH", match);
				console.log("EXTRACTED", extracted);
				return parseInt(extracted);
			}
		}
		return -1;
	}
}