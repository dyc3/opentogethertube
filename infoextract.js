const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const moment = require("moment");
const _ = require("lodash");
const storage = require("./storage");

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL,
});

module.exports = {
	YtApi,

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
		if (service === "youtube") {
			if (!(/^[A-za-z0-9_-]+$/).exec(id)) {
				throw new Error(`Invalid youtube video ID: ${id}`);
			}
		}

		return storage.getVideoInfo(service, id).then(result => {
			let video = _.cloneDeep(result);
			let missingInfo = storage.getVideoInfoFields().filter(p => !video.hasOwnProperty(p));
			if (missingInfo.length === 0) {
				return video;
			}

			console.warn(`MISSING INFO for ${video.service}:${video.id}: ${missingInfo}`);

			if (video.service === "youtube") {
				return this.getVideoInfoYoutube([video.id], missingInfo).then(result => {
					video = Object.assign(video, result[video.id]);
					return video;
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
		if (typeof link !== "string") {
			return false;
		}

		let srcUrl = url.parse(link);
		if (srcUrl.host === null) {
			return false;
		}

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
			return urlParsed.path.replace("/", "").trim();
		}
		else {
			let query = querystring.parse(urlParsed.query);
			if (query["v"]) {
				return query["v"].trim();
			}
			else {
				return null;
			}
		}
	},

	getChanneInfoYoutube(channelData) {
		return YtApi.get('/channels' +
			`?key=${process.env.YOUTUBE_API_KEY}&` +
			'part=contentDetails&' +
			`${Object.keys(channelData)[0] === 'channel' ? 'id' : 'forUsername'}=${Object.values(channelData)[0]}`
			//if the link passed is a channel link, ie: /channel/$CHANNEL_ID, then the id filter must be used
			//on the other hand, a user link requires the forUsername filter
		).then(res => {
			if (res.status === 200) {
				return this.getPlaylistYoutube(
					res.data.items[0].contentDetails.relatedPlaylists.uploads
				).catch(err => console.error(err));
			}
			else {
				console.error(`Failed with status code ${res.status}`);
			}
		}).catch(err => console.error(err));
	},

	getVideoInfoYoutube(ids, onlyProperties=null) {
		if (!Array.isArray(ids)) {
			throw "`ids` must be an array on video IDs.";
		}
		return new Promise((resolve, reject) => {
			let parts = [];
			if (onlyProperties !== null) {
				if (onlyProperties.includes("title") || onlyProperties.includes("description") || onlyProperties.includes("thumbnail")) {
					parts.push("snippet");
				}
				if (onlyProperties.includes("length")) {
					parts.push("contentDetails");
				}

				if (parts.length === 0) {
					console.error("onlyProperties must have valid values or be null! Found", onlyProperties);
					return null;
				}
			}
			else {
				parts = [
					"snippet",
					"contentDetails",
				];
			}
			YtApi.get(`/videos?key=${process.env.YOUTUBE_API_KEY}&part=${parts.join(",")}&id=${ids.join(",")}`).then(res => {
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
					};
					if (item.snippet) {
						video.title = item.snippet.title;
						video.description = item.snippet.description;
						if (item.snippet.thumbnails) {
							if (item.snippet.thumbnails.medium) {
								video.thumbnail = item.snippet.thumbnails.medium.url;
							}
							else {
								video.thumbnail = item.snippet.thumbnails.default.url;
							}
						}
					}
					if (item.contentDetails) {
						video.length = moment.duration(item.contentDetails.duration).asSeconds();
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

				// update cache
				for (const video of results) {
					storage.updateVideoInfo(video);
				}

				resolve(results);
			}).catch(err => {
				reject(err);
			});
		});
	},

	getManyPreviews(playlist) {
		//get info for all videos in playlist, then return all non-deleted videos
		return Promise.all(
			playlist.map(video => this.getVideoInfo('youtube', video.id))
		).then(previews => previews.filter(item => item !== undefined))
		.catch(err => console.error('Error getting video info:', err));
	},

	getAddPreview(input) {
		const service = this.getService(input);

		if (service !== "youtube") {
			console.error("Unsupported input for getAddPreview");
			throw "Unsupported input for getAddPreview";
		}

		let id = null;

		const urlParsed = url.parse(input.trim());
		const queryParams = querystring.parse(urlParsed.query);
		if (service == "youtube" && queryParams["v"]) {
			id = this.getVideoIdYoutube(input);
		}


		if (queryParams["list"]) {
			// there is a playlist associated with this link
			console.log("playlist found");
			return new Promise((resolve, reject) => {
				this.getPlaylistYoutube(queryParams["list"]).then(playlist => {
					console.log(`Found ${playlist.length} videos in playlist`);
					this.getManyPreviews(playlist).then(previews => resolve(previews));
				}).catch(err => {
					if (queryParams.v) {
						console.warn(`Playlist does not exist, retreiving video...`);
						return this.getVideoInfo(service, queryParams.v).then(video => {
							resolve([video]);
						}).catch(err => {
							console.error("Failed to compile add preview: error getting video:", err);
							reject(err);
						});
					}
					else {
						console.error("Failed to compile add preview: error getting playlist:", err);
						reject(err);
					}
				});
			});
		}
		else if (urlParsed.path.startsWith('/user') || urlParsed.path.startsWith('/channel')) {
			console.log('channel found');
			const channelData = {};
			const channelId = urlParsed.path.slice(urlParsed.path.lastIndexOf('/') + 1);
			if (urlParsed.path.startsWith('/channel/')) {
				channelData.channel = channelId;
			}
			else {
				channelData.user = channelId;
			}
			return this.getChanneInfoYoutube(channelData)
				.then(newestVideos => this.getManyPreviews(newestVideos))
				.catch(err => console.error('Error getting channel info:', err));
		}
		else {
			let video = {
				service: service,
				id: id,
				title: id,
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
