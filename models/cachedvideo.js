'use strict';
module.exports = (sequelize, DataTypes) => {
  const CachedVideo = sequelize.define('CachedVideo', {
    service: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serviceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    thumbnail: DataTypes.STRING,
    length: DataTypes.INTEGER,
    mime: DataTypes.STRING,
  }, {});
  // eslint-disable-next-line no-unused-vars
  CachedVideo.associate = function(models) {
    // associations can be defined here
  };
  return CachedVideo;
};
