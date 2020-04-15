'use strict';
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    name: DataTypes.STRING,
    title: DataTypes.STRING,
    description: DataTypes.STRING,
    visibility: DataTypes.STRING,
    ownerId: {
      type: DataTypes.INTEGER,
      defaultValue: -1,
      allowNull: false,
    },
  }, {});
  // eslint-disable-next-line no-unused-vars
  Room.associate = function(models) {
    Room.belongsTo(models.User, { foreignKey: "ownerId", as: "owner" });
  };
  return Room;
};
