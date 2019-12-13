'use strict';
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    name: DataTypes.STRING,
    title: DataTypes.STRING,
    description: DataTypes.STRING,
    visibility: DataTypes.STRING,
  }, {});
  // eslint-disable-next-line no-unused-vars
  Room.associate = function(models) {
    // associations can be defined here
  };
  return Room;
};
