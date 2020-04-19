'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Rooms', 'ownerId', {
      type: Sequelize.INTEGER,
      defaultValue: -1,
      allowNull: false,
    });
  },

  // eslint-disable-next-line no-unused-vars
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Rooms', 'ownerId');
  },
};
