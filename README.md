# OpenTogetherTube

[![Build Status](https://travis-ci.com/dyc3/opentogethertube.svg?branch=master)](https://travis-ci.com/dyc3/opentogethertube)
[![codecov](https://codecov.io/gh/dyc3/opentogethertube/branch/master/graph/badge.svg)](https://codecov.io/gh/dyc3/opentogethertube)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=dyc3_opentogethertube&metric=alert_status)](https://sonarcloud.io/dashboard?id=dyc3_opentogethertube)

The easy way to watch videos with your friends.

http://opentogethertube.com/

# Contributing

Contributions are welcome. The current iteration is named "Firework", and you can
see what's currently being worked on under the "projects" tab.

## Setting up your dev environment

### Prerequisites

This project targets the lastest LTS version of node.js.

### Setup

1. Fork this repo and clone it.

	*If you are planning to deploy this yourself, make sure you are on the `master` branch.*

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

### Testing

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


# Deployment

1. Clone this repo.
```
git clone https://github.com/dyc3/opentogethertube.git
```
2. Install despendencies.
```
npm install
```
3. Build Vue files so they can be served statically.
```
npm run build
```
4. Run the server.
```
npm start
```

You can also specify the port the server will listen on by setting the
`PORT` environment variable.

```
PORT=8080 npm start
```

## Docker

Go to [Docker](docker/DOCKER.md)
