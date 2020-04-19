'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        // eslint-disable-next-line array-bracket-newline
        len: [1, Infinity],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          args: [
            {
              require_tld: process.env.NODE_ENV === 'production',
            },
          ],
        },
      },
    },
    salt: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        // eslint-disable-next-line array-bracket-newline
        len: [1, 255],
      },
    },
    hash: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
  }, {});
  // eslint-disable-next-line no-unused-vars
  User.associate = function(models) {
    // User.hasMany(models.Room, { as: "rooms" });
  };
  return User;
};
