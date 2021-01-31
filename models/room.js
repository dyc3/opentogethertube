'use strict';
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9_-]+$/i,
        len: [3, 32],
      },
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    visibility: {
      type: DataTypes.STRING,
      defaultValue: "public",
      validate: {
        // eslint-disable-next-line array-bracket-newline
        isIn: [["public", "unlisted", "private"]],
      },
    },
    ownerId: {
      type: DataTypes.INTEGER,
      defaultValue: -1,
      allowNull: false,
    },
    permissions: {
      type: DataTypes.TEXT,
    },
    "role-admin": {
      type: DataTypes.TEXT,
    },
    "role-mod": {
      type: DataTypes.TEXT,
    },
    "role-trusted": {
      type: DataTypes.TEXT,
    },
  }, {});
  // eslint-disable-next-line no-unused-vars
  Room.associate = function(models) {
    Room.belongsTo(models.User, { foreignKey: "ownerId", as: "owner" });
  };
  return Room;
};
