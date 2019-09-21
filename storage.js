const { Room } = require("./models");

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
		// TODO: get video info from db
		return new Promise(resolve => resolve({ service, id }));
	},
};
