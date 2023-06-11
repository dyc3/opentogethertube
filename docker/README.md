# Docker

[Install Docker](https://docs.docker.com/install/)

[Install Docker-Compose](https://docs.docker.com/compose/install/)

You can run the application using the development image or production/deployment image.

## Use Image

Make sure to supply the youtube api key in `env/production.toml`

```bash
cp env/example.toml env/production.toml
```

You run the docker container using the docker-compose file in the root directory by using the following command.

```bash
docker-compose up -d
```

Go to http://localhost:8080/

## How to build and use the image locally

The production image uses docker-compose with redis and postgres in separate containers.

To use the production image, please follow the steps below.

1. Next you need to set up your configuration. Start by copying the example
   config in the `env` folder to a new file called `production.toml`

```bash
cp env/example.toml env/production.toml
```

1. Open `env/production.toml` and put your youtube API key in.

2. To build the image locally using the prod image make sure you are in the project root `/opentogethertube`
   before runing the command below.

```bash
docker-compose -f docker/docker-compose.yml up -d
```

4. Wait for everything to finish starting, and go to http://localhost:8080/

## Debug

You can open a shell inside of the container with the following command.

```bash
docker exec -it opentogethertube sh
```

You can also see the logs for the multiples containers with the following command.

```bash
docker-compose -f docker/docker-compose.yml logs
```

You can check for the status of the application and the other container in the docker-compose file with the following command.

```bash
docker-compose -f docker/docker-compose.yml ps
```

You also rebuild the docker image with the following command.

```bash
docker-compose -f docker/docker-compose.yml up -d --build
```
