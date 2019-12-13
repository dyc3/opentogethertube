const _ = require("lodash");
const moment = require("moment");
const { Room, CachedVideo } = require("./models");

module.exports = {
	getRoomByName(roomName) {
		return Room.findOne({
			where: { name: roomName },
		}).then(room => {
			return {
				name: room.name,
				title: room.title,
				description: room.description,
				visibility: room.visibility,
			};
		}).catch(err => {
			console.error("Failed to get room by name:", err);
		});
	},
	saveRoom(room) {
		return Room.create({
			name: room.name,
			title: room.title,
			description: room.description,
			visibility: room.visibility,
		}).then(result => {
			console.log("Saved room to db: id", result.dataValues.id);
			return true;
		}).catch(err => {
			console.error("Failed to save room to storage:", err);
			return false;
		});
	},
	// eslint-disable-next-line no-unused-vars
	updateRoom: function(room) {
		// TODO: update existing room in db
	},
	/**
	 * Gets cached video information from the database. If cached information
	 * is invalid, it will be omitted from the returned video object.
	 * @param	{string} service The service that hosts the source video.
	 * @param	{string} id The id of the video on the given service.
	 * @return	{Object} Video object, but it may contain missing properties.
	 */
	getVideoInfo(service, id) {
		return CachedVideo.findOne({ where: { service: service, serviceId: id } }).then(cachedVideo => {
			if (cachedVideo === null) {
				console.log("Cache missed:", service, id);
				return { service, id };
			}
			const origCreatedAt = moment(cachedVideo.createdAt);
			const lastUpdatedAt = moment(cachedVideo.updatedAt);
			const today = moment();
			// We check for changes every at an interval of 30 days, unless the original cache date was
			// less than 7 days ago, then the interval is 7 days. The reason for this is that the uploader
			// is unlikely to change the video info after a week of the original upload. Since we don't store
			// the upload date, we pretend the original cache date is the upload date. This is potentially an
			// over optimization.
			const isCachedInfoValid = lastUpdatedAt.diff(today, "days") <= (origCreatedAt.diff(today, "days") <= 7) ? 7 : 30;
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
			if (cachedVideo.thumbnail !== null) {
				video.thumbnail = cachedVideo.thumbnail;
			}
			if (cachedVideo.length !== null) {
				video.length = cachedVideo.length;
			}
			return video;
		}).catch(err => {
			console.warn("Cache failure", err);
			return { service, id };
		});
	},
	/**
	 * Updates the database with the given video. If the video exists in
	 * the database, it is overwritten. Omitted properties will not be
	 * overwritten. If the video does not exist in the database, it will be
	 * created.
	 * @param {Object} video Video object to store
	 */
	updateVideoInfo(video) {
		video = _.cloneDeep(video);
		video.serviceId = video.id;
		delete video.id;

		return CachedVideo.findOne({ where: { service: video.service, serviceId: video.serviceId } }).then(cachedVideo => {
			console.log(`Found video ${video.service}:${video.serviceId} in cache`);
			CachedVideo.update(video, { where: { id: cachedVideo.id } }).then(rowsUpdated => {
				console.log("Updated database records, updated", rowsUpdated, "rows");
				return true;
			}).catch(err => {
				console.error("Failed to cache video info", err);
				return false;
			});
		}).catch(() => {
			return CachedVideo.create(video).then(() => {
				console.log(`Stored video info for ${video.service}:${video.serviceId} in cache`);
				return true;
			}).catch(err => {
				console.error("Failed to cache video info", err);
				return false;
			});
		});
	},
	getVideoInfoFields() {
		let fields = [];
		for (let column in CachedVideo.rawAttributes) {
			if (column === "id" || column === "createdAt" || column === "updatedAt" || column === "serviceId") {
				continue;
			}
			fields.push(column);
		}
		return fields;
	},
};
