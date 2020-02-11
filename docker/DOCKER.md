# Docker

[Install Docker](https://docs.docker.com/install/)

You can run the application using the development image or production/deployment image.

## Development

To use the development image, please follow the steps below.

1. Next you need to set up your configuration. Start by copying the example
config in the `env` folder to a new file called `development.env`

   ```bash
   cp env/example.env env/development.env
   ```

2. Open `env/development.env` and replace `API_KEY_GOES_HERE` with the youtube api key.

3. To build the image locally, make sure you are in the project root `/opentogethertube`
   before runing the command below.

   ```bash
   docker build -f docker/dev/Dockerfile -t opentogethertube-dev .
   docker run --name opentogethertube-dev -d -p 8080:8080 opentogethertube-dev
   ```

You can run the unit test from the dev container using this command.

```bash
docker exec -it opentogethertube-dev npm test
```

You can run the linter from the dev container using this command.

```bash
docker exec -it opentogethertube-dev npm lint
```

## Production

To use the production image, please follow the steps below.

1. Next you need to set up your configuration. Start by copying the example
config in the `env` folder to a new file called `production.env`

   ```bash
   cp env/example.env env/production.env
   ```

2. Open `env/production.env` and replace `API_KEY_GOES_HERE` with the youtube api key.

3. To build the image locally using the prod image make sure you are in the project root `/opentogethertube`
   before runing the command below.

   ```bash
   docker build -f docker/prod/Dockerfile -t opentogethertube-prod .
   docker run --name opentogethertube-prod -d -p 8080:8080 opentogethertube-prod
   ```

## Docker Compose

You can also use docker compose after you have build the image locally.

```bash
docker-compose -d -f docker/<dev or prod>/docker-compose.yml up
```

After, you can stop the container.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml down
```

## Debug

You can open a shell inside of the container with the following command.

```bash
docker exec -it opentogethertube-<dev or prod> bash
```
