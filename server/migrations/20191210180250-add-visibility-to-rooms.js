'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Rooms', 'visibility', {
      type: Sequelize.STRING,
      defaultValue: 'public',
      allowNull: false,
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Rooms', 'visibility');
  },
};
