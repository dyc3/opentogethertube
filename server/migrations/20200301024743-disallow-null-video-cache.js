"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn("CachedVideos", "service", {
			type: Sequelize.STRING,
			allowNull: false,
		});
		await queryInterface.changeColumn("CachedVideos", "serviceId", {
			type: Sequelize.STRING,
			allowNull: false,
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn("CachedVideos", "service", {
			type: Sequelize.STRING,
			allowNull: true,
		});
		await queryInterface.changeColumn("CachedVideos", "serviceId", {
			type: Sequelize.STRING,
			allowNull: true,
		});
	},
};
