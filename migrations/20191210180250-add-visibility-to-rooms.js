'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Rooms', 'visibility', {
      type: Sequelize.STRING,
      defaultValue: 'public',
      allowNull: false,
    });
  },

  // eslint-disable-next-line no-unused-vars
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Rooms', 'visibility');
  },
};
