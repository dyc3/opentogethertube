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
			return true
		}).catch(err => {
			console.error("Failed to save room to storage:", err);
			return false;
		});
	},
	updateRoom: function(room) {
		// TODO: update existing room in db
	}
}