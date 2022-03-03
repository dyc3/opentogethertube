"use strict";

module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.addColumn("Rooms", "ownerId", {
			type: Sequelize.INTEGER,
			defaultValue: -1,
			allowNull: false,
		});
	},

	down: (queryInterface, Sequelize) => {
		return queryInterface.removeColumn("Rooms", "ownerId");
	},
};
