"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(`
			DELETE FROM "CachedVideos"
			WHERE "id" NOT IN (
				SELECT MIN("id")
				FROM "CachedVideos"
				GROUP BY "service", "serviceId"
			);
		`);
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
