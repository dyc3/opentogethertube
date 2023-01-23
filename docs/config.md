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
| `DISCORD_CLIENT_ID` | Discord oauth client ID | None
| `DISCORD_CLIENT_SECRET` | Discord oauth client secret | None
| `GOOGLE_CLIENT_ID` | Currently unused
| `GOOGLE_CLIENT_SECRET` | Currently unused
| `REDIS_URL` | URI to your redis server. Overrides `REDIS_HOST`, and `REDIS_PORT`. If not supplied, it will try to connect to the redis server on the local machine. | None |
| `REDIS_TLS_URL` | Works like, but prioritized over `REDIS_URL` | None |
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
| `ADD_PREVIEW_SEARCH_MIN_LENGTH` | Minimum length of an add preview search query. Add preview queries shorter than this number are rejected. Does not affect URL add previews. | `3` | Integer >= 0
| `ENABLE_SEARCH` | Enable searching for videos when no link is detected. | `true` | boolean
| `SEARCH_PROVIDER` | Service adapter to use to provide video search results. | `youtube` | `youtube`
| `ADD_PREVIEW_PLAYLIST_RESULTS_COUNT` | Limit the number of videos that appear in the results when a playlist is used. | `40` | Integer >= 0
| `ADD_PREVIEW_SEARCH_RESULTS_COUNT` | Limit the number of videos that appear in the results when searching for a video. | `10` | Integer >= 0
| `OTT_SHORT_URL_HOSTNAME` | The domain to use in the copyable "Share Invite" URL. This environment var must be present during building the client, otherwise it will not work. | undefined | `string` |
| `TRUST_PROXY` | The number of reverse proxy layers to trust. | `1` | `number` |
| `FFPROBE_PATH` | The path to the command `ffprobe`. You probably don't need to set this unless you are having problems with the ffprobe that is install automatically. | (see [@ffprobe-installer/ffprobe](https://github.com/SavageCore/node-ffprobe-installer)) | `string` |
| `DIRECT_PREVIEW_MAX_BYTES` | The number of bytes to download when trying to preview direct playback videos. | Infinity | Integer >= 0 |
| `RATE_LIMIT_KEY_PREFIX` | The prefix to use for rate limit keys, which are stored in redis. | `rateLimit` | `string` |
| `ENABLE_RATE_LIMIT` | Enable rate limiting. | `true` | `boolean` |
