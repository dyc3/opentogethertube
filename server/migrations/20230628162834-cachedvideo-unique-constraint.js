"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addConstraint("CachedVideos", {
			fields: ["service", "serviceId"],
			type: "UNIQUE",
			name: "unique_service_serviceId",
		});
		await queryInterface.addIndex("CachedVideos", {
			fields: ["service", "serviceId"],
			unique: true,
			name: "cachedvideo_service_serviceId",
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeConstraint("CachedVideos", "unique_service_serviceId");
		await queryInterface.removeIndex("CachedVideos", "cachedvideo_service_serviceId");
	},
};
