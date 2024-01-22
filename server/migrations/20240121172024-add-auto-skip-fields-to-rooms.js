'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
		await queryInterface.addColumn("Rooms", "autoSkipSegmentCategories", {
			type: Sequelize.JSONB,
			defaultValue: {
        'sponsor': true,
        'intro': true,
        'outro': true,
        'interaction': true,
        'selfpromo': true,
        'music_offtopic': true,
        'preview': true
      },
			allowNull: false,
		});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("Rooms", "autoSkipSegmentCategories");
  }
};
