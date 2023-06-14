# How to deploy OTT (Self-hosted)

## Quickstart

The easiest way to deploy OTT on your own server is to use docker-compose.

This method will run OTT in production mode, using redis and postgresql. However, this doesn't include a reverse proxy, so you will need to set that up yourself. Additionally, this will not automatically update OTT when a new version is released.

1. Install docker and docker-compose
2. Clone the repository
```bash
git clone https://github.com/dyc3/opentogethertube.git
cd opentogethertube
```
1. Copy the example configuration file
```bash
cp env/example.toml env/production.toml
```
1. Edit the configuration file to your liking.
   1. You'll likely want to grab a youtube api key from [Google Cloud](https://console.cloud.google.com)
2. Run docker-compose
```bash
docker-compose up -d
```

## Requirements

Using docker-compose is the easiest way to deploy OTT, but you can also deploy it manually.

In order to run OTT, you will need the following components:
- A nodejs installation matches the versions specified in the [package.json](../package.json) file.
- Redis
- PostgreSQL (recommended) or you can use sqlite (not recommended)
- A Youtube API key (obtained from [Google Cloud](https://console.cloud.google.com))

Copy the example configuration file and edit it to your liking.
```bash
cp env/example.toml env/production.toml
```

After you have set those up, you need to run the database migrations, and build the client. You have to do this every time you update OTT.
```bash
npm install -g yarn
yarn install
NODE_ENV=production yarn workspace ott-server run sequelize-cli db:migrate
yarn run build
```

After that, you can start the server.
```bash
NODE_ENV=production yarn start
```

## Configuration

Configuration is done through toml files in the `env` directory. The easiest way to get started is to copy the example file and fill it out.

```bash
cp env/example.toml env/production.toml
```

Read more about configuration in the [config docs](config.md).

## Using SQLite

SQLite is not recommended for production use, but it is possible. To use SQLite, you must set `db.mode` to `sqlite` in your configuration file. You must also use this command to run the database migrations.
```bash
NODE_ENV=production DB_MODE=sqlite yarn workspace ott-server run sequelize-cli db:migrate
```
