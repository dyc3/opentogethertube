const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const moment = require("moment");

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
	},

	getPlaylistYoutube(id) {
		return new Promise((resolve, reject) => {
			YtApi.get(`/playlistItems?key=${process.env.YOUTUBE_API_KEY}&part=snippet&playlistId=${id}`).then(res => {
				if (res.status !== 200) {
					reject(`Failed with status code ${res.status}`);
					return;
				}

				let results = [];
				for (let i = 0; i < res.data.items.length; i++) {
					let item = res.data.items[i];
					results.push({
						service: "youtube",
						id: item.snippet.resourceId.videoId,
						title: item.snippet.title,
						description: item.snippet.description,
						thumbnail: item.snippet.thumbnails.medium.url,
					});
				}
				resolve(results);
			}).catch(err => {
				reject(err);
			});
		});
	},

	getAddPreview(input) {
		let service = this.getService(input);

		if (service !== "youtube") {
			console.error("Unsupported input for getAddPreview");
			throw "Unsupported input for getAddPreview";
		}

		let urlParsed = url.parse(input);
		let queryParams = querystring.parse(urlParsed.query);
		if (queryParams["list"]) {
			// there is a playlist associated with this link
			console.log("playlist found");
			return new Promise((resolve, reject) => {
				this.getPlaylistYoutube(queryParams["list"]).then(playlist => {
					let videoIds = playlist.map(item => item.id);
					console.log(`Found ${playlist.length} videos in playlist`);

					this.getVideoInfoYoutube(videoIds).then(infoResults => {
						let addPreviewResults = [];
						for (let i = 0; i < videoIds.length; i++) {
							const videoInfo = infoResults[videoIds[i]];
							let video = {
								service: "youtube",
								id: videoIds[i],
								title: videoInfo.snippet.title,
								description: videoInfo.snippet.description,
								thumbnail: videoInfo.snippet.thumbnails.medium.url,
								length: moment.duration(videoInfo.contentDetails.duration).asSeconds(),
							}
							if (queryParams["v"] && video.id === queryParams["v"]) {
								video.highlight = true;
							}
							addPreviewResults.push(video);
						}
						resolve(addPreviewResults);
					}).catch(err => {
						console.error("Failed to compile add preview:", err);
						reject(err);
					});
				}).catch(err => {
					console.error("Failed to compile add preview:", err);
					reject(err);
				});
			});
		}
		else {
			let video = {
				service: "youtube",
				id: queryParams.v,
				title: queryParams.v
			};
			return this.getVideoInfoYoutube([video.id]).then(results => {
				let videoInfo = results[queryParams.v];
				video.title = videoInfo.snippet.title;
				video.description = videoInfo.snippet.description;
				video.thumbnail = videoInfo.snippet.thumbnails.medium.url;
				video.length = moment.duration(videoInfo.contentDetails.duration).asSeconds();
			}).catch(err => {
				console.error("Failed to get video info");
				console.error(err);
			}).then(() => {
				return [video];
			});
		}
	},
}