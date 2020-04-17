# Docker

[Install Docker](https://docs.docker.com/install/)

[Install Docker-Compose](https://docs.docker.com/compose/install/)

You can run the application using the development image or production/deployment image.

## Use Image

You run the docker container suing the docker-compose file in the root directory `/opentogethertube` by using the following command.

Make sure to change The `YOUTUBE_API_KEY` go the read README.md

```bash
docker-compose up -d
```

Go to http://localhost:8080/ 

## Production

The production image uses docker-compose with redis and postgres in separate containers.

To use the production image, please follow the steps below.

1. Next you need to set up your configuration. Start by copying the example
   config in the `env` folder to a new file called `production.env`

```bash
cp env/example.env env/production.env
```

2. Open `env/production.env` and replace `API_KEY_GOES_HERE` with the api keys.

3. To build the image locally using the prod image make sure you are in the project root `/opentogethertube`
   before runing the command below.

```bash
docker-compose -f docker/docker-compose.yml up -d
```

4. After Go to http://localhost:8080/

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
