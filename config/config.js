if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const path = require('path');
  let rootDir = path.resolve(__dirname + "/..");
  if (!fs.existsSync(path.join(rootDir, "./db"))) {
    fs.mkdirSync(path.join(rootDir, "./db"));
  }
}

module.exports = {
  "development": {
    "username": "root",
    "password": null,
    "database": "db_opentogethertube_dev",
    "host": "127.0.0.1",
    "dialect": "sqlite",
    "operatorsAliases": false,
    "storage": "db/dev.sqlite",
  },
  "test": {
    "username": "root",
    "password": null,
    "database": "db_opentogethertube_test",
    "host": "127.0.0.1",
    "dialect": "sqlite",
    "operatorsAliases": false,
  },
  "production": {
    "username": "ott",
    "password": process.env.DB_PASSWORD,
    "database": "db_opentogethertube_prod",
    "host": "127.0.0.1",
    "dialect": "postgres",
    "operatorsAliases": false,
  },
};
