const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const moment = require("moment");
const storage = require("./storage");

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL,
});

module.exports = {
	/**
	 * Gets all necessary information needed to represent a video. Handles
	 * local caching and obtaining missing data from external sources.
	 * Note that this function does not update the cache. That should be
	 * handled by the functions that actually retrieve missing info.
	 * @param	{string} service The service that hosts the source video.
	 * @param	{string} id The id of the video on the given service.
	 * @return	{Object} Video object
	 */
	getVideoInfo(service, id) {
		// TODO: check if service is valid
		// TODO: check if id is valid for service
		return storage.getVideoInfo(service, id).then(result => {
			let video = {};
			for (const key in result) {
				if (result.hasOwnProperty(key)) {
					video[key] = result[key];
				}
			}
			let missingInfo = [
				"title",
				"description",
				"thumbnail",
				"length",
			].filter(p => !video.hasOwnProperty(p));
			if (missingInfo.length === 0) {
				return video;
			}

			if (video.service === "youtube") {
				return this.getVideoInfoYoutube([video.id]).then(result => {
					return result[video.id];
				}).catch(err => {
					console.error("Failed to get youtube video info:", err);
					throw err;
				});
			}
		}).catch(err => {
			console.error("Failed to get video metadata from database:", err);
		});
	},

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
					let video = {
						service: "youtube",
						id: item.id,
						title: item.snippet.title,
						description: item.snippet.description,
						thumbnail: "",
						length: moment.duration(item.contentDetails.duration).asSeconds(),
					};
					if (item.snippet.thumbnails) {
						if (item.snippet.thumbnails.medium) {
							video.thumbnail = item.snippet.thumbnails.medium.url;
						}
						else {
							video.thumbnail = item.snippet.thumbnails.default.url;
						}
					}
					results[item.id] = video;
				}

				// update cache
				for (const id in results) {
					storage.updateVideoInfo(results[id]);
				}

				resolve(results);
			}).catch(err => {
				reject(err);
			});
		});
	},

	getVideoLengthYoutube_Fallback: async (url) => {
		let res = await axios.get(url);
		let regexs = [
/length_seconds":"\d+/, /lengthSeconds\\":\\"\d+/,
];
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
			YtApi.get(`/playlistItems?key=${process.env.YOUTUBE_API_KEY}&part=snippet&playlistId=${id}&maxResults=50`).then(res => {
				if (res.status !== 200) {
					reject(`Failed with status code ${res.status}`);
					return;
				}

				let results = [];
				for (let i = 0; i < res.data.items.length; i++) {
					let item = res.data.items[i];
					let video = {
						service: "youtube",
						id: item.snippet.resourceId.videoId,
						title: item.snippet.title,
						description: item.snippet.description,
					};
					if (item.snippet.thumbnails) {
						if (item.snippet.thumbnails.medium) {
							video.thumbnail = item.snippet.thumbnails.medium.url;
						}
						else {
							video.thumbnail = item.snippet.thumbnails.default.url;
						}
					}
					results.push(video);
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
							if (!videoInfo) {
								// Failed to get info for this video
								// video has probably been deleted, skip it
								continue;
							}
							let video = videoInfo;
							if (queryParams["v"] && video.id === queryParams["v"]) {
								video.highlight = true;
							}
							addPreviewResults.push(video);
						}
						resolve(addPreviewResults);
					}).catch(err => {
						console.error("Failed to compile add preview: error getting video info:", err);
						reject(err);
					});
				}).catch(err => {
					console.error("Failed to compile add preview: error getting playlist:", err);
					reject(err);
				});
			});
		}
		else {
			let video = {
				service: service,
				id: queryParams.v,
				title: queryParams.v,
			};
			return this.getVideoInfo(video.service, video.id).then(result => {
				video = result;
			}).catch(err => {
				console.error("Failed to get video info");
				console.error(err);
			}).then(() => {
				return [video];
			});
		}
	},
};
