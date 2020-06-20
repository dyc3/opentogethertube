'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 255],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
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
      type: DataTypes.BLOB,
      allowNull: true,
      validate: {
        len: [1, 256],
      },
    },
    hash: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    discordId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    validate: {
      ensureCredentials() {
        if ((!this.email || !this.hash || !this.salt) && !this.discordId) {
          throw new Error('Incomplete login credentials. Requires social login or email/password.');
        }
      },
    },
  });
  // eslint-disable-next-line no-unused-vars
  User.associate = function(models) {
    // User.hasMany(models.Room, { as: "rooms" });
  };
  return User;
};
