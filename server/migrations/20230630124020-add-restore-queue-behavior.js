"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("Rooms", "restoreQueueBehavior", {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 1,
		});
	},

	// biome-ignore lint/correctness/noUnusedFunctionParameters: biome migration
	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn("Rooms", "restoreQueueBehavior");
	},
};
