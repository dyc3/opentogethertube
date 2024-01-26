'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn("Rooms", "autoSkipSegments");
		await queryInterface.addColumn("Rooms", "autoSkipSegmentCategories", {
			type: Sequelize.JSONB,
			defaultValue: [
        'sponsor', 'intro', 'outro', 'interaction', 'selfpromo', 'music_offtopic', 'preview'
      ],
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
