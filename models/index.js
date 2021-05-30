'use strict';

import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const configs = require(__dirname + '/../config/config.js');
const db = {};

let config;
if (env === 'production') {
  if (process.env.DB_MODE === "postgres" || process.env.DOCKER) {
    config = configs[env];
  }
  else if (process.env.DB_MODE === "sqlite") {
    config = configs["production-sqlite"];
  }
}
else {
  config = configs[env];
}

let sequelize;
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // for heroku
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
    },
  });
}
else if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
}
else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js' || file.slice(-3) === '.ts');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db["Room"].belongsTo(db["User"], { foreignKey: "ownerId", as: "owner" });

module.exports = db;
export default db;
