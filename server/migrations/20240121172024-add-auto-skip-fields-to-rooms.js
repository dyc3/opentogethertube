"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn("Rooms", "autoSkipSegmentCategories", {
			type: Sequelize.JSONB,
			defaultValue: [
				"sponsor",
				"intro",
				"outro",
				"interaction",
				"selfpromo",
				"music_offtopic",
				"preview",
			],
			allowNull: false,
		});

		await queryInterface.sequelize.query(`
			UPDATE "Rooms"
			SET "autoSkipSegmentCategories" = '[]'
			WHERE "autoSkipSegments" = false;
		`);

		await queryInterface.removeColumn("Rooms", "autoSkipSegments");
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.addColumn("Rooms", "autoSkipSegments", {
			type: Sequelize.BOOLEAN,
			defaultValue: true,
			allowNull: false,
		});

		await queryInterface.sequelize.query(`
			UPDATE "Rooms"
			SET "autoSkipSegments" = false
			WHERE "autoSkipSegmentCategories" = '[]';
		`);

		await queryInterface.removeColumn("Rooms", "autoSkipSegmentCategories");
	},
};
