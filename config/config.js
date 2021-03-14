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
    "storage": "db/dev.sqlite",
  },
  "test": {
    "username": "root",
    "password": null,
    "database": "db_opentogethertube_test",
    "host": "127.0.0.1",
    "dialect": "sqlite",
    "operatorsAliases": false,
    "storage": "db/test.sqlite",
    "logging": false,
  },
  "production": process.env.DATABASE_URL ? {
    "url": process.env.DATABASE_URL,
    "dialect": "postgres",
    "logging": false,
    "ssl": { rejectUnauthorized: false },
    "dialectOptions": {
      "ssl": { rejectUnauthorized: false },
    },
  } : {
    "username": process.env.POSTGRES_DB_USERNAME || "ott",
    "password": process.env.POSTGRES_DB_PASSWORD,
    "database": process.env.POSTGRES_DB_NAME || "db_opentogethertube_prod",
    "host": process.env.POSTGRES_DB_HOST || "127.0.0.1",
    "dialect": "postgres",
    "logging": false,
  },
  "production-sqlite": {
    "username": "root",
    "password": null,
    "database": "db_opentogethertube_prod",
    "host": "127.0.0.1",
    "dialect": "sqlite",
    "operatorsAliases": false,
    "storage": "db/production.sqlite",
    "logging": false,
  },
};
