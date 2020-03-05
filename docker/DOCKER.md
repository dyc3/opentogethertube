# Docker

[Install Docker](https://docs.docker.com/install/)

[Install Docker-Compose](https://docs.docker.com/compose/install/)

You can run the application using the development image or production/deployment image.

## Development

The development image use docker-compose with redis and postgres in seperate containers.

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
docker-compose -f docker/dev/docker-compose.yml up -d
```

4. Go to http://localhost:3001

You can run the test suite from the dev container using this command.

```bash
docker exec -it opentogethertube-dev npm test
```

You can run the linter from the dev container using this command.

```bash
docker exec -it opentogethertube-dev npm lint
```

## Production

The production image uses docker-compose with redis and postgres in separate containers.

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
docker-compose -f docker/prod/docker-compose.yml up -d
```

4. Go to http://localhost:8080/

## Debug

You can open a shell inside of the container with the following command.

```bash
docker exec -it opentogethertube_<dev or prod> bash
```

You can also see the logs for the multiples containers with the following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml logs
```

You can check for the status of the application and the other container in the docker compose file with following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml ps
```

You also rebuild the docker image with the following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml up -d --build
```