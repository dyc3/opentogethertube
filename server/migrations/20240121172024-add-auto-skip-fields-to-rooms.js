'use strict';

import { ALL_SKIP_CATEGORIES } from "common/constants";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn("Rooms", "autoSkipSegments");
		await queryInterface.addColumn("Rooms", "autoSkipSegmentCategories", {
			type: Sequelize.JSONB,
			defaultValue: ALL_SKIP_CATEGORIES,
			allowNull: false,
		});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("Rooms", "autoSkipSegmentCategories");
    await queryInterface.addColumn("Rooms", "autoSkipSegments", {
			type: Sequelize.BOOLEAN,
			defaultValue: true,
			allowNull: false,
		});
  }
};
