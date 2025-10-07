"use strict";

module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.addColumn("Rooms", "visibility", {
			type: Sequelize.STRING,
			defaultValue: "public",
			allowNull: false,
		});
	},

	// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
	down: (queryInterface, Sequelize) => {
		return queryInterface.removeColumn("Rooms", "visibility");
	},
};
