'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('CachedVideos', 'mime', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true,
    });
  },

  // eslint-disable-next-line no-unused-vars
  down: (queryInterface, Sequelize) => {
   return queryInterface.removeColumn('CachedVideos', 'mime');
  },
};
