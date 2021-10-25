# OpenTogetherTube

[![CI/CD](https://github.com/dyc3/opentogethertube/actions/workflows/main.yml/badge.svg)](https://github.com/dyc3/opentogethertube/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/dyc3/opentogethertube/branch/master/graph/badge.svg)](https://codecov.io/gh/dyc3/opentogethertube)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=dyc3_opentogethertube&metric=alert_status)](https://sonarcloud.io/dashboard?id=dyc3_opentogethertube)
[![Docker size](https://img.shields.io/docker/image-size/dyc3/opentogethertube)](https://hub.docker.com/r/dyc3/opentogethertube)

The easy way to watch videos with your friends.

https://opentogethertube.com/

# Deployment

### Prerequisites

This project targets node 12.

### Setup

1. Clone this repo.
```
git clone https://github.com/dyc3/opentogethertube.git
```

2. Install redis

Ubuntu
```
sudo apt install redis
```

3. Install dependencies.
```
npm install
```

4. Copy and fill out the configuration file
```
cp env/example.env env/production.env
```

**Please read the [config docs here](docs/config.md) for which options are required.**

5. Build Vue files so they can be served statically.
```
npm run build
```

6. Run database migrations
```
NODE_ENV=production-sqlite npx sequelize-cli db:migrate
```

7. Run the server.
```
NODE_ENV=production npm start
```

You can also specify the port the server will listen on by setting the
`PORT` environment variable.

```
PORT=8080 NODE_ENV=production npm start
```

## Docker

See the [Docker README](docker/README.md)

# Contributing

Contributions are welcome. The current iteration is named "Firework", and you can
see what's currently being worked on under the "projects" tab.

## Setting up your dev environment

### Prerequisites

This project targets the lastest LTS version of node.js.

### Setup

1. Fork this repo and clone it.
2. In a terminal, navigate to the `opentogethertube` folder and run
```
npm install
```
3. Next you need to set up your configuration. Start by copying the example
config in the `env` folder to a new file called `development.env`
```
cp env/example.env env/development.env
```
4. Create a new project on [Google Cloud](https://console.cloud.google.com)
5. Add "YouTube Data API v3" and "Google Drive API" to the project
6. Obtain a YouTube API key
7. Obtain a Google Drive API key
	- _Not necessary if you don't plan to stream videos from Google Drive, which you probably shouldn't do anyway because Google doesn't like that._
8. Open `env/development.env` and replace `API_KEY_GOES_HERE` with the appropriate api key.
9. Initialize your local database.
```
npx sequelize-cli db:migrate
```
10. Install [redis](https://redis.io). This is used to store room state and user sessions across server restarts.

## Testing

To run the test suite, run
```
npm test
```

## How to run

This project has 2 main components: the client and the server. You can run
both of them simultaneously using the command
#### Linux / Mac
```
npm run dev
```
#### Windows
```
npm run dev-windows
```

Sometimes, you may want to run them seperately so you can use breakpoints to
debug. Using VSCode, this is trivial.

To start the server: `Debug > Select "Launch Program" > Start`

To start the client: `npm run serve`

## Swags of Hacktoberfest:
- Many of the candidates get attracted towards hacktoberfest to get swags . So, after 4 successfully merged pull request as for 2021 you will be eligible to get a Hacktoberfest T-shirt and Some stickers on your doorstep.
 
     <li><B><p><img src="https://miro.medium.com/max/1050/1*4JctIO7irt8hFxBmTvUpiQ.jpeg" width="400" height="225" style="width: 400px; height: 225px;" alt="tshirt image"></a></p><p><img src="https://miro.medium.com/max/1050/1*jkffr74bq5RsQ_xqDhgqYQ.jpeg" width="400" height="225" style="width: 400px; height: 225px;" alt="stickers image"></p>
</b></li>
