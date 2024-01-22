# Contributing

## Setting up your dev environment

There's 2 ways you can set up your dev environment: using docker via dev containers or using your local machine. I recommend using your local machine because waiting for docker to build is slow and annoying.

### Prerequisites

This project targets node 18 and up. I recommend using [nvm](https://github.com/nvm-sh/nvm) to manage your node versions.

I also recommend using the github cli (note this is different from git) to make PRs.

### Linux/WSL Dependencies

#### Ubuntu

```bash
sudo apt-get install --no-install-recommends build-essential ca-certificates apt-utils libsqlite3-dev libpq-dev libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 libsodium-dev libtool-bin libtool pkg-config autoconf
```

### Setting up the Monolith on your local machine or WSL

The Monolith refers to the node.js server that serves the client and handles all the business logic. It is located in the `server` folder. The client is located in the `client` folder, which should also work after you set up the Monolith.

1. Clone this repo.
2. In a terminal, navigate to the `opentogethertube` folder and run
```
npm install -g yarn
yarn
```
3. Next you need to set up your configuration. Start by copying the example
config in the `env` folder to a new file called `development.toml`
```
cp env/example.toml env/development.toml
```
4. Add API keys to `env/development.toml` (optional):
   1. Create a new project on [Google Cloud](https://console.cloud.google.com)
   2. Add "YouTube Data API v3" and "Google Drive API" to the project
   3. Obtain a YouTube API key (optional)
   4. Obtain a Google Drive API key (optional)
      - _Not necessary if you don't plan to stream videos from Google Drive, which you probably shouldn't do anyway because Google doesn't like that._
   5. Open `env/development.toml` and put in the appropriate api keys.
5.  Initialize your local databases.
```
yarn workspace ott-server run sequelize-cli db:migrate
```
6.   Install [redis](https://redis.io). This is used to store room state and user sessions across server restarts. Make sure it's running.

### Setting up using devcontainer

You can use docker and the provided devcontainer config `.devcontainer/devcontainer.json` to set up your dev environment. This is the easiest way to get started quickly.

1. Install VSCode
2. Install the devcontainer extension: `ms-vscode-remote.remote-containers`
3. Open the project in VSCode
4. Open the command palette <kbd>Ctrl+Shift+P</kbd> and run `Dev Containers: Reopen in Container`
5. Follow the steps from the previous section from step 3

## Testing

Make sure your test sqlite database is up to date by running this command. You should only need to do this once, or if you change the database schema with a migration.
```
NODE_ENV=test yarn workspace ott-server run sequelize-cli db:migrate
```

To run the linter, run
```
yarn lint
```

To run the unit test suite, run
```
yarn test
```

To run the e2e component test suite, run
```
yarn run cy:run --component
```

To run the e2e test suite, run
```
yarn run cy:run
```

However, while you're developing, you'll probably want to run the tests in headed mode. To do this, run
```
yarn run cy:open
```
This works for both the component and e2e tests.

## How to run

This project has 2 main components: the client and the server. You can run
both of them simultaneously using the command
#### Linux / Mac
```
yarn run dev
```
#### Windows
```
yarn run dev-windows
```

Sometimes, you may want to run them seperately so you can use breakpoints to
debug. Using VSCode, this is trivial.

To start the server: `Debug > Select "Launch Program" > Start`

To start the client: `yarn workspace ott-client serve`
