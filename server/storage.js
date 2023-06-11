const _ = require("lodash");
const dayjs = require("dayjs");
const { CachedVideo, sequelize } = require("./models");
const Sequelize = require("sequelize");
const { getLogger } = require("./logger.js");
import { setupPostgresMetricsCollection } from "./storage.metrics";
import { conf } from "./ott-config";
import { getRoomByName, isRoomNameTaken, saveRoom, updateRoom } from "./storage/room";

const log = getLogger("storage");
if (conf.get("env") === "production" && conf.get("db.mode") !== "sqlite") {
	setupPostgresMetricsCollection(sequelize);
}

module.exports = {
	getRoomByName,
	saveRoom,
	isRoomNameTaken,
	updateRoom,
	/**
	 * Gets cached video information from the database. If cached information
	 * is invalid, it will be omitted from the returned video object.
	 * @param	{string} service The service that hosts the source video.
	 * @param	{string} id The id of the video on the given service.
	 * @return	{Object} Video object, but it may contain missing properties.
	 */
	getVideoInfo(service, id) {
		return CachedVideo.findOne({ where: { service: service, serviceId: id } })
			.then(cachedVideo => {
				if (cachedVideo === null) {
					log.info(`Cache missed: ${service} ${id}`);
					return { service, id };
				}
				const origCreatedAt = dayjs(cachedVideo.createdAt);
				const lastUpdatedAt = dayjs(cachedVideo.updatedAt);
				const today = dayjs();
				// We check for changes every at an interval of 30 days, unless the original cache date was
				// less than 7 days ago, then the interval is 7 days. The reason for this is that the uploader
				// is unlikely to change the video info after a week of the original upload. Since we don't store
				// the upload date, we pretend the original cache date is the upload date. This is potentially an
				// over optimization.
				const isCachedInfoValid =
					lastUpdatedAt.diff(today, "days") <= (origCreatedAt.diff(today, "days") <= 7)
						? 7
						: 30;
				let video = {
					service: cachedVideo.service,
					id: cachedVideo.serviceId,
				};
				// We only invalidate the title and description because those are the only ones that can change.
				if (cachedVideo.title !== null && isCachedInfoValid) {
					video.title = cachedVideo.title;
				}
				if (cachedVideo.description !== null && isCachedInfoValid) {
					video.description = cachedVideo.description;
				}
				if (
					cachedVideo.thumbnail !== null &&
					((video.service !== "googledrive" && isCachedInfoValid) ||
						(video.service === "googledrive" &&
							lastUpdatedAt.diff(today, "hour") <= 12))
				) {
					video.thumbnail = cachedVideo.thumbnail;
				}
				if (cachedVideo.length !== null && isCachedInfoValid) {
					video.length = cachedVideo.length;
				}
				if (cachedVideo.mime !== null) {
					video.mime = cachedVideo.mime;
				}
				return video;
			})
			.catch(err => {
				log.warn(`Cache failure ${err}`);
				return { service, id };
			});
	},
	/**
	 * Gets cached video information from the database. If cached information
	 * is invalid, it will be omitted from the returned video object.
	 * Does not guarantee order will be maintained.
	 * @param	{Array.<Video|Object>} videos The videos to find in the cache.
	 * @return	{Promise.<Object>} Video object, but it may contain missing properties.
	 */
	getManyVideoInfo(videos) {
		const { or, and } = Sequelize.Op;

		videos = videos.map(video => {
			video = _.cloneDeep(video);
			video.serviceId = video.id;
			delete video.id;
			return video;
		});

		return CachedVideo.findAll({
			where: {
				[or]: videos.map(video => {
					return {
						[and]: [{ service: video.service }, { serviceId: video.serviceId }],
					};
				}),
			},
		})
			.then(foundVideos => {
				if (videos.length !== foundVideos.length) {
					for (let video of videos) {
						if (!_.find(foundVideos, video)) {
							foundVideos.push(video);
						}
					}
				}
				return foundVideos.map(cachedVideo => {
					const origCreatedAt = dayjs(cachedVideo.createdAt);
					const lastUpdatedAt = dayjs(cachedVideo.updatedAt);
					const today = dayjs();
					// We check for changes every at an interval of 30 days, unless the original cache date was
					// less than 7 days ago, then the interval is 7 days. The reason for this is that the uploader
					// is unlikely to change the video info after a week of the original upload. Since we don't store
					// the upload date, we pretend the original cache date is the upload date. This is potentially an
					// over optimization.
					const isCachedInfoValid =
						lastUpdatedAt.diff(today, "days") <=
						(origCreatedAt.diff(today, "days") <= 7)
							? 7
							: 30;
					let video = {
						service: cachedVideo.service,
						id: cachedVideo.serviceId,
					};
					// We only invalidate the title and description because those are the only ones that can change.
					if (cachedVideo.title && isCachedInfoValid) {
						video.title = cachedVideo.title;
					}
					if (cachedVideo.description && isCachedInfoValid) {
						video.description = cachedVideo.description;
					}
					if (cachedVideo.thumbnail && isCachedInfoValid) {
						video.thumbnail = cachedVideo.thumbnail;
					}
					if (cachedVideo.length && isCachedInfoValid) {
						video.length = cachedVideo.length;
					}
					if (cachedVideo.mime) {
						video.mime = cachedVideo.mime;
					}
					return video;
				});
			})
			.catch(err => {
				log.warn(`Cache failure ${err}`);
				return videos;
			});
	},
	/**
	 * Updates the database with the given video. If the video exists in
	 * the database, it is overwritten. Omitted properties will not be
	 * overwritten. If the video does not exist in the database, it will be
	 * created.
	 * @param {Video|Object} video Video object to store
	 */
	updateVideoInfo(video, shouldLog = true) {
		video = _.cloneDeep(video);
		if (!video.serviceId) {
			video.serviceId = video.id;
			delete video.id;
		}

		return CachedVideo.findOne({
			where: { service: video.service, serviceId: video.serviceId },
		})
			.then(cachedVideo => {
				if (shouldLog) {
					log.info(`Found video ${video.service}:${video.serviceId} in cache`);
				}
				return CachedVideo.update(video, { where: { id: cachedVideo.id } }).then(
					rowsUpdated => {
						if (shouldLog) {
							log.info(`Updated database records, updated ${rowsUpdated[0]} rows`);
						}
						return true;
					}
				);
			})
			.catch(() => {
				return CachedVideo.create(video)
					.then(() => {
						if (shouldLog) {
							log.info(
								`Stored video info for ${video.service}:${video.serviceId} in cache`
							);
						}
						return true;
					})
					.catch(err => {
						log.error(`Failed to cache video info ${err}`);
						return false;
					});
			});
	},
	/**
	 * Updates the database for all the videos in the given list. If a video
	 * exists in the database, it is overwritten. Omitted properties will not
	 * be overwritten. If the video does not exist in the database, it will be
	 * created.
	 *
	 * This also minimizes the number of database queries made by doing bulk
	 * queries instead of a query for each video.
	 * @param {Array} videos List of videos to store.
	 */
	updateManyVideoInfo(videos) {
		const { or, and } = Sequelize.Op;

		videos = videos.map(video => {
			video = _.cloneDeep(video);
			video.serviceId = video.id;
			delete video.id;
			return video;
		});

		return CachedVideo.findAll({
			where: {
				[or]: videos.map(video => {
					return {
						[and]: [{ service: video.service }, { serviceId: video.serviceId }],
					};
				}),
			},
		}).then(async foundVideos => {
			let [toUpdate, toCreate] = _.partition(videos, video =>
				_.find(foundVideos, { service: video.service, serviceId: video.serviceId })
			);
			log.debug(
				`bulk cache: should update ${toUpdate.length} rows, create ${toCreate.length} rows`
			);
			let promises = toUpdate.map(video => this.updateVideoInfo(video, false));
			if (toCreate.length) {
				promises.push(CachedVideo.bulkCreate(toCreate));
			}
			return Promise.all(promises).then(() => {
				log.info(
					`bulk cache: created ${toCreate.length} rows, updated ${toUpdate.length} rows`
				);
				return true;
			});
		});
	},
	getVideoInfoFields(service = undefined) {
		let fields = [];
		for (let column in CachedVideo.rawAttributes) {
			if (
				column === "id" ||
				column === "createdAt" ||
				column === "updatedAt" ||
				column === "serviceId" ||
				column === "service"
			) {
				continue;
			}
			// eslint-disable-next-line array-bracket-newline
			if (["youtube", "vimeo", "dailymotion"].includes(service) && column === "mime") {
				continue;
			}
			if (service === "googledrive" && column === "description") {
				continue;
			}
			fields.push(column);
		}
		return fields;
	},
};
export default module.exports;
