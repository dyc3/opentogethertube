const axios = require("axios");
const url = require("url");
const querystring = require('querystring');
const _ = require("lodash");
const storage = require("./storage");
const Video = require("./common/video.js");
const { getLogger } = require("./logger.js");
const { redisClient } = require('./redisclient.js');
const ffprobe = require('./ffprobe.js');
const {
	UnsupportedServiceException,
	InvalidAddPreviewInputException,
  OutOfQuotaException,
  InvalidVideoIdException,
	FeatureDisabledException,
	UnsupportedMimeTypeException,
	LocalFileException,
	MissingMetadataException,
} = require("./server/exceptions");
const DailyMotionAdapter = require("./server/services/dailymotion");
const DirectVideoAdapter = require("./server/services/direct");
const GoogleDriveAdapter = require("./server/services/googledrive");
const VimeoAdapter = require("./server/services/vimeo");
const YouTubeAdapter = require("./server/services/youtube");

const log = getLogger("infoextract");

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const ADD_PREVIEW_SEARCH_MIN_LENGTH = 3;
const YtApi = axios.create({
	baseURL: YOUTUBE_API_URL,
});
const YtFallbackApi = axios.create();
const VIMEO_OEMBED_API_URL = "https://vimeo.com/api/oembed.json";
const VimeoApi = axios.create();
const DAILYMOTION_API_URL = "https://api.dailymotion.com";
// const DAILYMOTION_OEMBED_API_URL = "http://www.dailymotion.com/services/oembed";
const DailymotionApi = axios.create({
	baseURL: DAILYMOTION_API_URL,
});
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const GoogleDriveApi = axios.create({
	baseURL: GOOGLE_DRIVE_API_URL,
});

if (process.env.DEBUG_FAKE_YOUTUBE_OUT_OF_QUOTA) {
	YtApi.get = () => Promise.reject({ response: { status: 403 } });
}

const adapters = [
	new DailyMotionAdapter(),
	new GoogleDriveAdapter(),
	new VimeoAdapter(),
	new YouTubeAdapter(process.env.YOUTUBE_API_KEY),
	new DirectVideoAdapter(),
];

module.exports = {
	YtApi,
	YtFallbackApi,
	VimeoApi,
	DailymotionApi,
	redisClient,
	ffprobe,

	/**
	 * Returns the service adapter instance for a given service
	 * @param {string} service
	 */
	getServiceAdapter(service) {
		return adapters.find(adapter => adapter.serviceId === service);
	},

	/**
	 * Gets all necessary information needed to represent a video. Handles
	 * local caching and obtaining missing data from external sources.
	 * @param	{string} service The service that hosts the source video.
	 * @param	{string} id The id of the video on the given service.
	 * @return	{Promise<Video>} Video object
	 */
	getVideoInfo(service, id) {
		if (service === "vimeo") {
			if (!(/^[0-9]+$/).exec(id)) {
				return Promise.reject(new InvalidVideoIdException(service, id));
			}
		}
		else if (service === "dailymotion") {
			if (!(/^[A-za-z0-9]+$/).exec(id)) {
				return Promise.reject(new InvalidVideoIdException(service, id));
			}
		}
		else if (service === "googledrive") {
			if (!(/^[A-za-z0-9_-]+$/).exec(id)) {
				return Promise.reject(new InvalidVideoIdException(service, id));
			}
		}
		else if (service === "direct") {
			return this.getVideoInfoDirect(id);
		}

		return storage.getVideoInfo(service, id).then(result => {
			let video = _.cloneDeep(result);
			let missingInfo = storage.getVideoInfoFields(video.service).filter(p => !video.hasOwnProperty(p));
			if (missingInfo.length === 0) {
				video = new Video(video);
				if (video.service === "googledrive" && !this.isSupportedMimeType(video.mime)) {
					throw new UnsupportedMimeTypeException(video.mime);
				}
				return video;
			}

			log.warn(`MISSING INFO for ${video.service}:${video.id}: ${missingInfo}`);

			if (video.service === "youtube") {
				let adapter = this.getServiceAdapter("youtube");
				return adapter.getVideoInfo([video.id], missingInfo).then(result => {
					return Video.merge(video, result[video.id]);
				}).catch(err => {
					if (err.name === "OutOfQuotaException") {
						log.error("Failed to get youtube video info: Out of quota");
						if (missingInfo.length < storage.getVideoInfoFields(video.service).length) {
							log.warn(`Returning cached results for ${video.service}:${video.id}`);
							return result;
						}
						else {
							throw err;
						}
					}
					else {
						log.error(`Failed to get youtube video info: ${err}`);
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
			else if (video.service === "googledrive") {
				return this.getVideoInfoGoogleDrive(video.id).then(result => {
					return Video.merge(video, result);
				}).catch(err => {
					if (err.name === "OutOfQuotaException") {
						log.error("Failed to get google drive file info: Out of quota");
						if (missingInfo.length < storage.getVideoInfoFields(video.service).length) {
							log.warn(`Returning cached results for ${video.service}:${video.id}`);
							return result;
						}
						else {
							throw err;
						}
					}
					else {
						log.error(`Failed to get google drive file info: ${err}`);
						throw err;
					}
				});
			}
		}).catch(err => {
			log.error(`Failed to get video metadata: ${err}`);
			throw err;
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
				let groupedServiceVideos = _.groupBy(serviceVideos, video => storage.getVideoInfoFields(service).filter(p => !video.hasOwnProperty(p)));

				if (service === "youtube") {
					let adapter = this.getServiceAdapter("youtube");
					let promises = [];
					for (let missingInfo in groupedServiceVideos) {
						let missingInfoGroup = groupedServiceVideos[missingInfo];
						if (!missingInfo) {
							promises.push(Promise.resolve(missingInfoGroup));
							continue;
						}
						let promise = adapter.getVideoInfo(missingInfoGroup.map(video => video.id), missingInfo).then(results => {
							return missingInfoGroup.filter(video => results[video.id]).map(video => {
								return Video.merge(video, results[video.id]);
							});
						});
						promises.push(promise);
					}
					return Promise.all(promises);
				}
				else {
					log.error(`Unknown service: ${service}`);
					return Promise.resolve(serviceVideos);
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
	 * @returns {Promise.<Array<Video>>}
	 * @throws UnsupportedServiceException
	 * @throws InvalidAddPreviewInputException
	 * @throws OutOfQuotaException
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
		else if (service === "googledrive") {
			id = this.getVideoIdGoogleDrive(input);
		}

		if (urlParsed.host && service !== "youtube" && service !== "vimeo" && service !== "dailymotion" && service !== "googledrive" && service !== "direct") {
			return Promise.reject(new UnsupportedServiceException(urlParsed));
		}
		else if (!urlParsed.host) {
			if (process.env.ENABLE_YOUTUBE_SEARCH) {
				if (input.length < ADD_PREVIEW_SEARCH_MIN_LENGTH) {
					return Promise.reject(new InvalidAddPreviewInputException(ADD_PREVIEW_SEARCH_MIN_LENGTH));
				}
				return this.searchYoutube(input, options)
					.then(searchResults => this.getManyVideoInfo(searchResults))
					.catch(err => {
						if (err.name === "OutOfQuotaException") {
							log.error("Failed to search youtube for add preview: Out of quota");
							throw new OutOfQuotaException("youtube");
						}
						else {
							log.error(`Failed to search youtube for add preview: ${err}`);
							throw err;
						}
					});
			}
			else {
				return Promise.reject(new FeatureDisabledException("Youtube searches have been disabled by the administrator. See dyc3/opentogethertube#226 for more information."));
			}
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
									video.highlight = true;
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
							log.error(`Failed to compile add preview: error getting video: ${err}`);
							reject(err);
						});
					}
					else {
						if (err.response && err.response.status === 403) {
							log.error("Failed to compile add preview: error getting playlist: Out of quota");
							reject(new OutOfQuotaException("youtube"));
						}
						else {
							log.error(`Failed to compile add preview: error getting playlist: ${err}`);
							reject(err);
						}
					}
				});
			});
		}
		else if (service === "youtube" && !(urlParsed.host == "youtu.be" || urlParsed.path.startsWith("/watch"))) {
			log.debug("found youtube channel");
			const channelData = this.getChannelIdYoutube(urlParsed);
			return this.getChanneInfoYoutube(channelData)
				.then(newestVideos => this.getManyVideoInfo(newestVideos))
				.catch(err => log.error(`Error getting channel info: ${err}`));
		}
		else if (service === "googledrive" && urlParsed.path.startsWith("/drive")) {
			let folderId = this.getFolderIdGoogleDrive(input);
			log.info(`google drive folder found: ${folderId}`);
			return this.getFolderGoogleDrive(folderId)
				// .then(videos => this.getManyVideoInfo(videos))
				.catch(err => log.error(`Error getting google drive info: ${err}`));
		}
		else if (service === "direct") {
			return this.getVideoInfo(service, input).then(video => {
				return [video];
			});
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
				log.error(`Failed to get video info ${err}`);
				throw err;
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
		else if (srcUrl.host.endsWith("drive.google.com")) {
			return "googledrive";
		}
		else if (/\/*\.(mp4(|v)|mpg4|webm|flv|mkv|avi|wmv|qt|mov|ogv|m4v|h26[1-4])$/.exec(srcUrl.path.split("?")[0])) {
			return "direct";
		}
		else {
			return false;
		}
	},

	isSupportedMimeType(mime) {
		return !!/^video\/(?!x-flv)(?!x-matroska)(?!x-ms-wmv)(?!x-msvideo)[a-z0-9-]+$/.exec(mime);
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

	/**
	 * Gets the youtube channel ID or username from the link
	 * @param {import("url").UrlWithStringQuery|string} url
	 * @retuns Object with either `user` or `channel` set.
	 */
	getChannelIdYoutube(link) {
		if (typeof link === "string") {
			link = url.parse(link);
		}
		const channelData = {};
		const channelId = (/\/(?!(?:c(?:|hannel)|user)\/)([a-z0-9_-]+)/gi).exec(link.path)[1];
		if (link.path.startsWith('/channel/')) {
			channelData.channel = channelId;
		}
		else {
			channelData.user = channelId;
		}
		return channelData;
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
					reject(new OutOfQuotaException("youtube"));
				}
				else {
					reject(err);
				}
			});
		});
	},

	async getChanneInfoYoutube(channelData) {
		// TODO: maybe use relational db for this cache instead?
		let cachedPlaylistId = await new Promise((resolve, reject) => {
			redisClient.get(`ytchannel:${_.keys(channelData)[0]}:${_.values(channelData)[0]}`, (err, value) => {
				if (err) {
					reject(err);
					return;
				}
				if (!value) {
					resolve(null);
					return;
				}
				resolve(value);
			});
		});
		if (cachedPlaylistId) {
			// use the cached playlist id
			log.info("Using cached uploads playlist id");
			return this.getPlaylistYoutube(cachedPlaylistId);
		}

		return YtApi.get('/channels' +
			`?key=${process.env.YOUTUBE_API_KEY}&` +
			'part=contentDetails&' +
			`${Object.keys(channelData)[0] === 'channel' ? 'id' : 'forUsername'}=${Object.values(channelData)[0]}`
			//if the link passed is a channel link, ie: /channel/$CHANNEL_ID, then the id filter must be used
			//on the other hand, a user link requires the forUsername filter
		).then(res => {
			let uploadsPlaylistId = res.data.items[0].contentDetails.relatedPlaylists.uploads;
			redisClient.set(`ytchannel:${_.keys(channelData)[0]}:${_.values(channelData)[0]}`, uploadsPlaylistId, err => {
				if (err) {
					log.error(`Failed to cache channel uploads playlist: ${err}`);
				}
				else {
					log.info(`Cached channel uploads playlist: ytchannel:${_.keys(channelData)[0]}:${_.values(channelData)[0]}`);
				}
			});
			if (channelData.user) {
				// we can add a cache entry for the channel id as well.
				let channelId = res.data.items[0].id;
				redisClient.set(`ytchannel:channel:${channelId}`, uploadsPlaylistId, err => {
					if (err) {
						log.error(`Failed to cache channel uploads playlist: ${err}`);
					}
					else {
						log.info(`Cached channel uploads playlist: ytchannel:channel:${channelId}`);
					}
				});
			}
			return this.getPlaylistYoutube(uploadsPlaylistId);
		}).catch(err => {
			if (err.response && err.response.status === 403) {
				log.error(`Error when getting channel upload playlist ID: Out of Quota`);
				throw new OutOfQuotaException("youtube");
			}
			else {
				log.error(`Error when getting channel upload playlist ID: ${err}`);
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
					log.error(`Failed to cache search results: ${err}`);
				}
			});
			return results;
		}).catch(err => {
			if (err.response && err.response.status === 403) {
				throw new OutOfQuotaException("youtube");
			}
			else {
				throw err;
			}
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
				log.error(`Failed to get vimeo video info: ${err}`);
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
			log.error(`Failed to get dailymotion video info: ${err}`);
			return null;
		});
	},

	/* GOOGLE DRIVE */

	getVideoIdGoogleDrive(link) {
		let urlParsed = url.parse(link);
		if (urlParsed.path.startsWith("/file/d/")) {
			return urlParsed.path.split("/")[3];
		}
		else {
			let query = querystring.parse(urlParsed.query);
			return query["id"];
		}
	},

	getFolderIdGoogleDrive(link) {
		let urlParsed = url.parse(link);
		if (/^\/drive\/u\/\d\/folders\//.exec(urlParsed.path)) {
			return urlParsed.path.split("/")[5].split("?")[0].trim();
		}
		else if (urlParsed.path.startsWith("/drive/folders")) {
			return urlParsed.path.split("/")[3].split("?")[0].trim();
		}
		else {
			throw new Error("Invalid google drive folder");
		}
	},

	parseGoogleDriveFile(file) {
		return new Video({
			service: "googledrive",
			id: file.id,
			title: file.name,
			thumbnail: file.thumbnailLink,
			length: Math.ceil(file.videoMediaMetadata.durationMillis / 1000),
			mime: file.mimeType,
		});
	},

	getVideoInfoGoogleDrive(id) {
		// https://stackoverflow.com/questions/57585838/how-to-get-thumbnail-of-a-video-uploaded-to-google-drive
		return GoogleDriveApi.get(`/files/${id}?key=${process.env.GOOGLE_DRIVE_API_KEY}&fields=id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis)`).then(res => {
			// description is not provided
			let video = this.parseGoogleDriveFile(res.data);
			// video.id = id;
			storage.updateVideoInfo(video);
			if (!this.isSupportedMimeType(video.mime)) {
				throw new UnsupportedMimeTypeException(video.mime);
			}
			return video;
		}).catch(err => {
			if (err.response && err.response.data.error && err.response.data.error.errors[0].reason === "dailyLimitExceeded") {
				throw new OutOfQuotaException("googledrive");
			}
			else {
				if (err.response && err.response.data.error) {
					log.error(`Failed to get google drive video metadata: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
				}
				else {
					log.error(`Failed to get google drive video metadata: ${err}: ${JSON.stringify(err.response.data)}`);
				}
				throw err;
			}
		});
	},

	getFolderGoogleDrive(id) {
		return GoogleDriveApi.get(`/files?q="${id}"+in+parents&key=${process.env.GOOGLE_DRIVE_API_KEY}&fields=files(id,name,mimeType,thumbnailLink,videoMediaMetadata(durationMillis))`).then(res => {
			log.info(`Found ${res.data.files.length} items in folder`);
			return res.data.files.map(item => this.parseGoogleDriveFile(item));
		}).catch(err => {
			if (err.response && err.response.data.error && err.response.data.error.errors[0].reason === "dailyLimitExceeded") {
				throw new OutOfQuotaException("googledrive");
			}
			else {
				if (err.response && err.response.data.error) {
					log.error(`Failed to get google drive folder: ${err.response.data.error.message} ${JSON.stringify(err.response.data.error.errors)}`);
				}
				else {
					log.error(`Failed to get google drive folder: ${err}: ${JSON.stringify(err.response.data)}`);
				}
				throw err;
			}
		});
	},

	/* DIRECT */

	async getVideoInfoDirect(link) {
		let srcUrl = url.parse(link);
		if (srcUrl.protocol === "file:") {
			throw new LocalFileException();
		}
		let fileName = srcUrl.path.split("/").slice(-1)[0].split("?")[0].trim();
		let extension = fileName.split(".").slice(-1)[0];
		let mime = "unknown";
		// TODO: swap this out with something more robust
		// http://svn.apache.org/repos/asf/httpd/httpd/trunk/docs/conf/mime.types
		switch (extension) {
			case "mp4":
			case "mp4v":
			case "mpg4":
				mime = "video/mp4";
				break;
			case "mkv":
			case "mk3d":
			case "mks":
				mime = "video/x-matroska";
				break;
			case "mov":
			case "qt":
				mime = "video/quicktime";
				break;
			case "webm":
				mime = "video/webm";
				break;
			case "flv":
				mime = "video/x-flv";
				break;
			case "avi":
				mime = "video/x-msvideo";
				break;
			case "wmv":
				mime = "video/x-ms-wmv";
				break;
			case "ogv":
				mime = "video/ogg";
				break;
			case "m4v":
				mime = "video/x-m4v";
				break;
			case "h264":
				mime = "video/h264";
				break;
		}
		if (!this.isSupportedMimeType(mime)) {
			throw new UnsupportedMimeTypeException(mime);
		}
		const fileInfo = await ffprobe.getFileInfo(link);
		let videoStream = _.find(fileInfo.streams, { "codec_type": "video" });
		if (!videoStream.duration) {
			log.error("Video duration could not be determined");
			throw new MissingMetadataException();
		}
		return new Video({
			service: "direct",
			url: link,
			title: fileName,
			description: `Full Link: ${link}`,
			mime,
			length: Math.ceil(videoStream.duration),
		});
	},
};
