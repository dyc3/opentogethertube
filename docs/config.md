# Configuring OpenTogetherTube

OTT is configured using `*.env` files located in the `env/` directory. The config that is read depends on the `NODE_ENV` environment variable. It's contents are series of key/value pairs, in the format `KEY=VALUE`.

## All available options

*Options marked as required are required for deployment*

| Name | Description | Default | Expected Values |
|-|-|-|-|
| `OTT_HOSTNAME` | **REQUIRED** Specify the domain or IP address (with port, if necessary) of the host | None | `localhost:8080`, `opentogethertube.com` |
| `PORT` | Specify the port the server listens on. | 8080 | 1-65535 |
| `LOG_FILE` | Path to the log file | `./logs/ott.log` | Any valid, writable path to a file.
| `LOG_LEVEL` | Only log messages with this log level or higher | `info` | `silly`, `debug`, `info`, `warn`, `error`
| `OPENTOGETHERTUBE_API_KEY` | **REQUIRED** API key used to perform administrative actions via the OTT web API. | None | Any alpha-numeric string >= 40 characters
| `SESSION_SECRET` | **REQUIRED** A secret used to make session cookies safer. | None | Any alpha-numeric string >= 80 characters
| `YOUTUBE_API_KEY` | **REQUIRED** Youtube api key from [Google Cloud](https://console.cloud.google.com) | None | A Youtube API key
| `GOOGLE_DRIVE_API_KEY` | **REQUIRED if you want google drive** Google drive api key from [Google Cloud](https://console.cloud.google.com). *Google drive really doesn't like to stream video, YMMV.* | None | A Google Drive API key
| `SPOTIFY_CLIENT_ID` | Spotify client get this in the Spotify Developper Dashboard after creating a new app | None
| `SPOTIFY_CLIENT_SECRET` | Spotify client SECRET get this in the Spotify Developper Dashboard after creating a new app | None
| `DISCORD_CLIENT_ID` | Discord oauth client ID | None
| `DISCORD_CLIENT_SECRET` | Discord oauth client secret | None
| `GOOGLE_CLIENT_ID` | Currently unused
| `GOOGLE_CLIENT_SECRET` | Currently unused
| `ENABLE_YOUTUBE_SEARCH` | Allows users to search youtube in the add preview box. | `0` | `0`, `1` |
| `REDIS_URL` | URI to your redis server. Overrides `REDIS_HOST`, and `REDIS_PORT`. If not supplied, it will try to connect to the redis server on the local machine. | None |
| `REDIS_HOST` | Hostname or IP of the redis server. If not supplied, it will try to connect to the redis server on the local machine. | `undefined` | Hostname or IP
| `REDIS_PORT` | Port of the redis server. If not supplied, it will try to connect to the redis server on the default port. | `undefined` | 1-65535
| `REDIS_DB` | Specify the redis DB that OTT should use. | `undefined` |
| `REDIS_PASSWORD` | Password for the redis server. If not supplied, it will not be used. | `undefined` | string
| `DB_MODE` | *Only if `NODE_ENV` is `production`* Force the server to use a database dialect. If not supplied, it will automatically use postgres if `DATABASE_URL`, `POSTGRES_DB_HOST`, `POSTGRES_DB_NAME`, `POSTGRES_DB_USERNAME`, `POSTGRES_DB_PASSWORD` are present. Otherwise, it will use SQLite. | None | `sqlite`, `postgres`
| `DATABASE_URL` | Connection URI to your postgres database. |
| `POSTGRES_DB_HOST` | Hostname or IP of the postgres server. | `127.0.0.1` | Hostname or IP
| `POSTGRES_DB_NAME` | Postgres database name | `db_opentogethertube_prod` | string
| `POSTGRES_DB_USERNAME` | Postgres username | `ott` | string
| `POSTGRES_DB_PASSWORD` | Postgres password | None | string