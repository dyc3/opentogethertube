const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const moment = require("moment");

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL,
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

	getChanneInfoYoutube(link) {
		return new Promise((resolve, reject) => {
			YtApi.get('/channels' +
				`?key=${process.env.YOUTUBE_API_KEY}&` +
				'part=contentDetails&' +
				`${link[1] === 'c' ? 'id' : 'forUsername'}=${link.slice(link.lastIndexOf('/')+1)}`
			).then(async res => {
				if (res.status === 200) {
					resolve(await this.getPlaylistYoutube(
						res.data.items[0].contentDetails.relatedPlaylists.uploads
					));
				} else {
					reject(`Failed with status code ${res.status}`);
				}
			}).catch(err => {
				reject(err);
			});
		});
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

	getManyPreviews(videoIds, qParamsV) {
		return new Promise(async (resolve, reject) => {
			try {
				const videoInfo = await this.getVideoInfoYoutube(videoIds);
				resolve(videoIds.map(id => videoInfo[id])
						   	.filter(info => info !== undefined) //remove deleted videos
						   	.map(info => {
									if (qParamsV && qParamsV === info.id) {
										info.highlight = true;
									}
									return info;
								}));
			} catch (err) {
				console.error("Failed to compile add preview: error getting video info:", err);
				reject(err);
			}
		});
	},

	getAddPreview(input) {
		const service = this.getService(input);

		if (service !== "youtube") {
			console.error("Unsupported input for getAddPreview");
			throw "Unsupported input for getAddPreview";
		}

		const urlParsed = url.parse(input);
		const queryParams = querystring.parse(urlParsed.query);
		if (queryParams["list"]) {
			// there is a playlist associated with this link
			console.log("playlist found");
			return new Promise((resolve, reject) => {
				this.getPlaylistYoutube(queryParams["list"]).then(playlist => {
					const videoIds = playlist.map(item => item.id);
					console.log(`Found ${playlist.length} videos in playlist`);
					resolve(this.getManyPreviews(videoIds, queryParams["v"]));
				}).catch(err => {
					console.error("Failed to compile add preview: error getting playlist:", err);
					reject(err);
				});
			});
		} else if (urlParsed.path.startsWith('/user') || urlParsed.path.startsWith('/channel')) {
			console.log('channel found');
			return new Promise((resolve, reject) => {
				this.getChanneInfoYoutube(urlParsed.path.slice(urlParsed.path.indexOf('/'))).then(res => {
					resolve(res);
				}).catch(err => reject(err));
			});
		} else {
			let video = {
				service: "youtube",
				id: queryParams.v,
				title: queryParams.v,
			};
			return this.getVideoInfoYoutube([video.id]).then(results => {
				video = results[queryParams.v];
			}).catch(err => {
				console.error("Failed to get video info");
				console.error(err);
			}).then(() => {
				return [video];
			});
		}
	},
};
