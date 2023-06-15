"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.changeColumn("rooms", "ownerId", {
			type: Sequelize.INTEGER,
			allowNull: true,
		});
		await queryInterface.sequelize.query("UPDATE rooms SET ownerId = NULL WHERE ownerId = -1;");
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.sequelize.query(
			"UPDATE rooms SET ownerId = -1 WHERE ownerId IS NULL;"
		);
		await queryInterface.changeColumn("rooms", "ownerId", {
			type: Sequelize.INTEGER,
			defaultValue: -1,
			allowNull: false,
		});
	},
};
