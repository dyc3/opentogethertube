"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Rooms", "autoSkipSegments", {
			type: Sequelize.BOOLEAN,
			defaultValue: true,
			allowNull: false,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Rooms", "autoSkipSegments");
	},
};
