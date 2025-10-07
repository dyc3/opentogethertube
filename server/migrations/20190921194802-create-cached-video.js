"use strict";
module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.createTable("CachedVideos", {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			service: {
				type: Sequelize.STRING,
			},
			serviceId: {
				type: Sequelize.STRING,
			},
			title: {
				type: Sequelize.STRING,
			},
			description: {
				type: Sequelize.TEXT,
			},
			thumbnail: {
				type: Sequelize.STRING,
			},
			length: {
				type: Sequelize.INTEGER,
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
		});
	},
	// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
	down: (queryInterface, Sequelize) => {
		return queryInterface.dropTable("CachedVideos");
	},
};
