const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const moment = require("moment");
const _ = require("lodash");
const storage = require("./storage");
const Video = require("./common/video.js");
const { getLogger } = require("./logger.js");

const log = getLogger("infoextract");

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const ADD_PREVIEW_SEARCH_MIN_LENGTH = 3;
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL,
});
const VIMEO_OEMBED_API_URL = "https://vimeo.com/api/oembed.json";
const VimeoApi = axios.create();
const DAILYMOTION_API_URL = "https://api.dailymotion.com";
// const DAILYMOTION_OEMBED_API_URL = "http://www.dailymotion.com/services/oembed";
const DailymotionApi = axios.create({
	baseURL: DAILYMOTION_API_URL,
});

class UnsupportedServiceException extends Error {
	constructor(hostname) {
		super(`The service at "${hostname}" is not yet supported.`);
		this.name = "UnsupportedServiceException";
	}
}

class InvalidAddPreviewInputException extends Error {
	constructor() {
		super(`Your search query must at least ${ADD_PREVIEW_SEARCH_MIN_LENGTH} characters, or supply a Youtube video, playlist, or channel link.`);
		this.name = "InvalidAddPreviewInputException";
	}
}

class OutOfQuotaException extends Error {
	constructor() {
		super(`We don't have enough Youtube API quota to complete the request. We currently have a limit of 10,000 quota per day.`);
		this.name = "OutOfQuotaException";
	}
}

let redisClient;

module.exports = {
	YtApi,
	VimeoApi,
	DailymotionApi,

	init(_redisClient) {
		redisClient = _redisClient;
	},

	/**
	 * Gets all necessary information needed to represent a video. Handles
	 * local caching and obtaining missing data from external sources.
	 * @param	{string} service The service that hosts the source video.
	 * @param	{string} id The id of the video on the given service.
	 * @return	{Video} Video object
	 */
	getVideoInfo(service, id) {
		if (service === "youtube") {
			if (!(/^[A-za-z0-9_-]+$/).exec(id)) {
				throw new Error(`Invalid youtube video ID: ${id}`);
			}
		}
		else if (service === "vimeo") {
			if (!(/^[0-9]+$/).exec(id)) {
				throw new Error(`Invalid vimeo video ID: ${id}`);
			}
		}
		else if (service === "dailymotion") {
			if (!(/^[A-za-z0-9]+$/).exec(id)) {
				throw new Error(`Invalid dailymotion video ID: ${id}`);
			}
		}

		return storage.getVideoInfo(service, id).then(result => {
			let video = _.cloneDeep(result);
			let missingInfo = storage.getVideoInfoFields().filter(p => !video.hasOwnProperty(p));
			if (missingInfo.length === 0) {
				return new Video(video);
			}

			log.warn(`MISSING INFO for ${video.service}:${video.id}: ${missingInfo}`);

			if (video.service === "youtube") {
				return this.getVideoInfoYoutube([video.id], missingInfo).then(result => {
					return Video.merge(video, result[video.id]);
				}).catch(err => {
					if (err.name === "OutOfQuotaException") {
						log.error("Failed to get youtube video info: Out of quota");
						return this.getVideoLengthYoutube_Fallback(`https://youtube.com/watch?v=${video.id}`).then(videoLength => {
							return new Video({
								...video,
								title: video.id,
								length: videoLength,
							});
						});
					}
					else {
						log.error("Failed to get youtube video info:", err);
						throw err;
					}
				});
			}
			else if (video.service === "vimeo") {
				return this.getVideoInfoVimeo(video.id);
			}
			else if (video.service === "dailymotion") {
				return this.getVideoInfoDailymotion(video.id);
			}
		}).catch(err => {
			log.error("Failed to get video metadata from database:", err);
		});
	},

	/**
	 * Gets all necessary information needed to represent all videos in the
	 * given list. Handles local caching and obtaining missing data from
	 * external sources.
	 *
	 * This also optimizes the number of requests made to external sources.
	 * @param {Array.<Video|Object>} videos
	 * @returns {Promise.<Array.<Video>>}
	 */
	getManyVideoInfo(videos) {
		let grouped = _.groupBy(videos, "service");
		let retrievalPromises = [];
		for (let service in grouped) {
			let retrievalPromise = storage.getManyVideoInfo(grouped[service]).then(serviceVideos => {
				// group by missing info
				// WARNING: Arrays can't be used as keys, so the array of strings gets turned in to a string. May cause issues?
				let groupedServiceVideos = _.groupBy(serviceVideos, video => storage.getVideoInfoFields().filter(p => !video.hasOwnProperty(p)));

				if (service === "youtube") {
					let promises = [];
					for (let missingInfo in groupedServiceVideos) {
						let missingInfoGroup = groupedServiceVideos[missingInfo];
						if (!missingInfo) {
							promises.push(new Promise(resolve => resolve(missingInfoGroup)));
							continue;
						}
						let promise = this.getVideoInfoYoutube(missingInfoGroup.map(video => video.id), missingInfo).then(results => {
							return missingInfoGroup.map(video => {
								return Video.merge(video, results[video.id]);
							});
						});
						promises.push(promise);
					}
					return Promise.all(promises);
				}
				else {
					log.error("Unknown service:", service);
					return new Promise(resolve => resolve(serviceVideos));
				}
			});
			retrievalPromises.push(retrievalPromise);
		}
		return Promise.all(retrievalPromises).then(results => {
			results = _.flattenDeep(results);

			// ensure the original order is preserved
			let finalResults = [];
			for (let result of results) {
				let idx = _.findIndex(videos, {
					service: result.service,
					id: result.id,
				});
				finalResults[idx] = new Video(result);
			}
			return finalResults;
		});
	},

	/**
	 * Gets a list of videos to make an add preview.
	 * @param {string} input User input
	 * @param {Object} options Optional extra parameters
	 * @param {string} options.fromUser A unique identifier indicating the user that made the request for the add preview. Should not contain sensitive information, because it will be sent to the youtube API as `quotaUser`.
	 * @returns {Array<Video>}
	 * @throws UnsupportedServiceException
	 * @throws InvalidAddPreviewInputException
	 */
	getAddPreview(input, options={}) {
		const service = this.getService(input);

		let id = null;

		const urlParsed = url.parse(input.trim());
		const queryParams = querystring.parse(urlParsed.query);
		if (service == "youtube" && (queryParams["v"] || urlParsed.host === "youtu.be")) {
			id = this.getVideoIdYoutube(input);
		}
		else if (service === "vimeo") {
			id = this.getVideoIdVimeo(input);
		}
		else if (service === "dailymotion") {
			id = this.getVideoIdDailymotion(input);
		}

		if (urlParsed.host && service !== "youtube" && service !== "vimeo" && service !== "dailymotion") {
			// FIXME: To be more consistent, instead of throwing exceptions like this
			// should be a promise that rejects with the exception.
			throw new UnsupportedServiceException(urlParsed.host);
		}
		else if (!urlParsed.host) {
			if (input.length < ADD_PREVIEW_SEARCH_MIN_LENGTH) {
				throw new InvalidAddPreviewInputException();
			}
			return this.searchYoutube(input, options)
				.then(searchResults => this.getManyVideoInfo(searchResults))
				.catch(err => {
					if (err.name === "OutOfQuotaException") {
						log.error("Failed to search youtube for add preview: Out of quota");
					}
					else {
						log.error("Failed to search youtube for add preview:", err);
					}
					throw err;
				});
		}

		if (service === "youtube" && queryParams["list"]) {
			// there is a playlist associated with this link
			log.info("playlist found");
			return new Promise((resolve, reject) => {
				this.getPlaylistYoutube(queryParams["list"]).then(playlist => {
					log.info(`Found ${playlist.length} videos in playlist`);
					this.getManyVideoInfo(playlist).then(previews => {
						if (id) {
							let highlighted = false;
							for (let preview of previews) {
								if (preview && preview.id === id) {
									preview.highlight = true;
									highlighted = true;
								}
							}
							if (!highlighted) {
								// Guarentee video is in add preview
								this.getVideoInfo(service, id).then(video => {
									resolve(_.concat([video], previews));
								}).catch(() => {
									resolve(previews);
								});
							}
							else {
								resolve(previews);
							}
						}
						else {
							resolve(previews);
						}
					});
				}).catch(err => {
					if (queryParams.v) {
						log.warn(`Playlist does not exist, retreiving video...`);
						return this.getVideoInfo(service, queryParams.v).then(video => {
							resolve([video]);
						}).catch(err => {
							log.error("Failed to compile add preview: error getting video:", err);
							reject(err);
						});
					}
					else {
						if (err.response.status === 403) {
							log.error("Failed to compile add preview: error getting playlist: Out of quota");
						}
						else {
							log.error("Failed to compile add preview: error getting playlist:", err);
						}
						reject(err);
					}
				});
			});
		}
		else if (service === "youtube" && (urlParsed.path.startsWith('/user') || urlParsed.path.startsWith('/channel'))) {
			log.info('channel found');
			const channelData = {};
			const channelId = urlParsed.path.slice(urlParsed.path.lastIndexOf('/') + 1);
			if (urlParsed.path.startsWith('/channel/')) {
				channelData.channel = channelId;
			}
			else {
				channelData.user = channelId;
			}
			return this.getChanneInfoYoutube(channelData)
				.then(newestVideos => this.getManyVideoInfo(newestVideos))
				.catch(err => log.error('Error getting channel info:', err));
		}
		else {
			let video = new Video({
				service: service,
				id: id,
				title: id,
			});
			return this.getVideoInfo(video.service, video.id).then(result => {
				return Video.merge(video, result);
			}).catch(err => {
				log.error("Failed to get video info");
				log.error(err);
				return [video];
			}).then(result => {
				return [result];
			});
		}
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
		else if (srcUrl.host.endsWith("vimeo.com")) {
			return "vimeo";
		}
		else if (srcUrl.host.endsWith("dailymotion.com") || srcUrl.host.endsWith("dai.ly")) {
			return "dailymotion";
		}
		else {
			return false;
		}
	},

	/* YOUTUBE */

	/**
	 * Gets the Youtube video id from the link.
	 * @param {string} link Youtube URL
	 * @returns {string|null} Youtube video id, or null if invalid
	 */
	getVideoIdYoutube(link) {
		let urlParsed = url.parse(link);
		if (urlParsed.host.endsWith("youtu.be")) {
			return urlParsed.path.replace("/", "").split("?")[0].trim();
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

	getVideoInfoYoutube(ids, onlyProperties=null) {
		if (!Array.isArray(ids)) {
			return new Promise((resolve, reject) => reject("`ids` must be an array on video IDs."));
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
					log.error("onlyProperties must have valid values or be null! Found", onlyProperties);
					reject(null);
					return;
				}
			}
			else {
				parts = [
					"snippet",
					"contentDetails",
				];
			}
			YtApi.get(`/videos?key=${process.env.YOUTUBE_API_KEY}&part=${parts.join(",")}&id=${ids.join(",")}`).then(res => {
				let results = {};
				for (let i = 0; i < res.data.items.length; i++) {
					let item = res.data.items[i];
					let video = new Video({
						service: "youtube",
						id: item.id,
					});
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
				// for (let video of _.values(results)) {
				// 	storage.updateVideoInfo(video);
				// }
				// resolve(results);

				storage.updateManyVideoInfo(_.values(results)).then(() => {
					resolve(results);
				});
			}).catch(err => {
				if (err.response && err.response.status === 403) {
					reject(new OutOfQuotaException());
				}
				else {
					reject(err);
				}
			});
		});
	},

	async getVideoLengthYoutube_Fallback(url) {
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
				log.info("MATCH", match);
				log.info("EXTRACTED", extracted);
				return parseInt(extracted);
			}
		}
		return -1;
	},

	getPlaylistYoutube(id) {
		return new Promise((resolve, reject) => {
			// Unfortunately, we have to request the `snippet` part in order to get the youtube video ids
			// The `id` part just gives playlistItemIds
			// The `contentDetails` part just gives the video id and the date the video was published.
			// Youtube API docs makes it unclear whether snippet or contentDetails costs more api quota,
			// so just stick with snippet i guess?
			YtApi.get(`/playlistItems?key=${process.env.YOUTUBE_API_KEY}&part=snippet&playlistId=${id}&maxResults=30`).then(res => {
				let results = [];
				for (let i = 0; i < res.data.items.length; i++) {
					let item = res.data.items[i];
					let video = new Video({
						service: "youtube",
						id: item.snippet.resourceId.videoId,
						title: item.snippet.title,
						description: item.snippet.description,
					});
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
				// for (let video of results) {
				// 	storage.updateVideoInfo(video);
				// }
				// resolve(results);

				storage.updateManyVideoInfo(results).then(() => {
					resolve(results);
				});
			}).catch(err => {
				if (err.response && err.response.status === 403) {
					reject(new OutOfQuotaException());
				}
				else {
					reject(err);
				}
			});
		});
	},

	getChanneInfoYoutube(channelData) {
		return YtApi.get('/channels' +
			`?key=${process.env.YOUTUBE_API_KEY}&` +
			'part=contentDetails&' +
			`${Object.keys(channelData)[0] === 'channel' ? 'id' : 'forUsername'}=${Object.values(channelData)[0]}`
			//if the link passed is a channel link, ie: /channel/$CHANNEL_ID, then the id filter must be used
			//on the other hand, a user link requires the forUsername filter
		).then(res => {
			return this.getPlaylistYoutube(
				res.data.items[0].contentDetails.relatedPlaylists.uploads
			);
		}).catch(err => {
			log.error(err);
			if (err.response.status === 403) {
				throw new OutOfQuotaException();
			}
			else {
				throw err;
			}
		});
	},

	/**
	 * Search Youtube for videos most related to the user's query
	 * @param {string} query The user's search query
	 * @param {Object} options Optional extra parameters
	 * @param {string|undefined} [options.fromUser=undefined] A unique identifier indicating the user that made the request for the add preview. Should not contain sensitive information, because it will be sent to the youtube API as `quotaUser`.
	 * @param {Number} [options.maxResults=8] The max number of results to return from the query.
	 * @returns {Array<Video>} An array of videos with only service and id set.
	 */
	async searchYoutube(query, options={}) {
		let cachedResults = await new Promise((resolve, reject) => {
			redisClient.get(`search:${query}`, (err, value) => {
				if (err) {
					reject(err);
					return;
				}
				if (!value) {
					resolve(null);
					return;
				}
				resolve(JSON.parse(value));
			});
		});
		if (cachedResults) {
			log.info("Using cached results for youtube search");
			return cachedResults;
		}

		options = _.defaults(options, {
			maxResults: 8,
		});
		let queryParams = {
			key: process.env.YOUTUBE_API_KEY,
			part: "id",
			type: "video",
			maxResults: options.maxResults,
			safeSearch: "none",
			videoEmbeddable: true,
			videoSyndicated: true,
			q: query,
		};
		if (options.fromUser) {
			queryParams.quotaUser = options.fromUser;
		}
		return YtApi.get(`/search?${querystring.stringify(queryParams)}`).then(res => {
			let results = res.data.items.map(searchResult => new Video({
				service: "youtube",
				id: searchResult.id.videoId,
			}));
			// results expire in 24 hours
			redisClient.set(`search:${query}`, JSON.stringify(results), "EX", 60 * 60 * 24, err => {
				if (err) {
					log.error("Failed to cache search results:", err);
				}
			});
			return results;
		});
	},

	/* VIMEO */

	/**
	 * Gets the Vimeo video id from the link.
	 * @param {string} link Vimeo URL
	 * @returns {string} Vimeo video id
	 */
	getVideoIdVimeo(link) {
		let urlParsed = url.parse(link);
		return urlParsed.path.split("/").slice(-1)[0].split("?")[0].trim();
	},

	/**
	 * Gets video metadata for vimeo videos.
	 *
	 * https://developer.vimeo.com/api/oembed/videos#embedding-a-video-with-oembed
	 * https://developer.vimeo.com/api/reference/videos#get_video
	 * @param {string} id The video id on vimeo
	 * @returns {Promise<Video>|null} Video with metadata, null if it fails to get metadata
	 */
	getVideoInfoVimeo(id) {
		// HACK: This API method doesn't require us to use authentication, but it gives us somewhat low res thumbnail urls
		return VimeoApi.get(`${VIMEO_OEMBED_API_URL}?url=https://vimeo.com/${id}`).then(res => {
			let video = new Video({
				service: "vimeo",
				id,
				title: res.data.title,
				description: res.data.description,
				thumbnail: res.data.thumbnail_url,
				length: res.data.duration,
			});
			storage.updateVideoInfo(video);
			return video;
		}).catch(err => {
			if (err.response && err.response.status === 403) {
				log.error("Failed to get vimeo video info: Embedding for this video is disabled");
				return null;
			}
			else {
				log.error("Failed to get vimeo video info:", err);
				return new Video({
					service: "vimeo",
					id,
				});
			}
		});
	},

	/* DAILYMOTION */

	/**
	 * Gets the Dailymotion video id from the link.
	 * @param {string} link Dailymotion URL
	 * @returns {string} Dailymotion video id
	 */
	getVideoIdDailymotion(link) {
		let urlParsed = url.parse(link);
		return urlParsed.path.split("/").slice(-1)[0].split("?")[0].trim();
	},

	/**
	 * Gets video metadata for dailymotion videos.
	 *
	 * https://developer.dailymotion.com/player/#player-oembed
	 * https://developer.dailymotion.com/tools/#/video
	 * @param {string} id The video id on dailymotion
	 * @returns {Promise<Video>|null} Video with metadata, null if it fails to get metadata
	 */
	getVideoInfoDailymotion(id) {
		return DailymotionApi.get(`/video/${id}?fields=title,description,thumbnail_url,duration`).then(res => {
			let video = new Video({
				service: "dailymotion",
				id,
				title: res.data.title,
				description: res.data.description,
				thumbnail: res.data.thumbnail_url,
				length: res.data.duration,
			});
			storage.updateVideoInfo(video);
			return video;
		}).catch(err => {
			log.error("Failed to get dailymotion video info:", err);
			return null;
		});
	},
};
