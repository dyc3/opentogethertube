'use strict';
module.exports = (sequelize, DataTypes) => {
  const CachedVideo = sequelize.define('CachedVideo', {
    service: DataTypes.STRING,
    service_id: DataTypes.STRING,
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    thumbnail: DataTypes.STRING,
    length: DataTypes.INTEGER,
  }, {});
  // eslint-disable-next-line no-unused-vars
  CachedVideo.associate = function(models) {
    // associations can be defined here
  };
  return CachedVideo;
};
