// const Sequelize = require('sequelize');

// const sequelize = new Sequelize('database', 'username', 'password', {
// 	host: 'localhost',
// 	dialect: 'sqlite', /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */
// 	storage: 'db/dev.sqlite'
// });

// class Room extends Sequelize.Model {}
// Room.init({
// 	id: { type: Sequelize.INTEGER, primaryKey: true, unique: true, autoIncrement: true },
// 	name: { type: Sequelize.STRING, allowNull: false, unique: true },
// 	title: { type: Sequelize.STRING, allowNull: false, defaultValue: "Room" },
// 	description: { type: Sequelize.STRING, allowNull: false, defaultValue: "" },
// }, { sequelize, modelName: 'room' })

const { Room } = require("./models");

module.exports = {
	getRoomByName(roomName) {
		return Room.findOne({ where: { name: roomName } }).then(room => {
			return room;
		});
	},
	saveRoom(room) {
		Room.create({
			name: room.name,
			title: room.title,
			description: room.description,
		}).then(result => {
			console.log("Saved room to db: id", result.dataValues.id);
		});
	}
}