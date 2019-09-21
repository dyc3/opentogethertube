const _ = require("lodash");
const { Room, CachedVideo } = require("./models");

module.exports = {
	getRoomByName(roomName) {
		return Room.findOne({ where: { name: roomName } }).then(room => {
			delete room.createdAt;
			delete room.updatedAt;
			return room;
		});
	},
	saveRoom(room) {
		return Room.create({
			name: room.name,
			title: room.title,
			description: room.description,
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
		return CachedVideo.findOne({ where: { service: service, service_id: id } }).then(cachedVideo => {
			if (cachedVideo === null) {
				console.log("Cache missed:", service, id);
				return { service, id };
			}
			let video = {
				service: cachedVideo.service,
				id: cachedVideo.service_id,
			};
			if (cachedVideo.title !== null) {
				video.title = cachedVideo.title;
			}
			if (cachedVideo.description !== null) {
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
		video.service_id = video.id;
		delete video.id;

		return CachedVideo.findOne({ where: { service: video.service, service_id: video.service_id } }).then(cachedVideo => {
			console.log(`Found video ${video.service}:${video.service_id} in cache`);
			CachedVideo.update(video, { where: { id: cachedVideo.id } }).then(rowsUpdated => {
				console.log("Updated database records, updated", rowsUpdated, "rows");
				return true;
			}).catch(err => {
				console.error("Failed to cache video info", err);
				return false;
			});
		}).catch(() => {
			return CachedVideo.create(video).then(() => {
				console.log(`Stored video info for ${video.service}:${video.service_id} in cache`);
				return true;
			}).catch(err => {
				console.error("Failed to cache video info", err);
				return false;
			});
		});
	},
};
