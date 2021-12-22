'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('CachedVideos', 'mime', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true,
    });
  },

  down: (queryInterface, Sequelize) => {
   return queryInterface.removeColumn('CachedVideos', 'mime');
  },
};
