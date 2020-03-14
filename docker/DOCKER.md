# Docker

[Install Docker](https://docs.docker.com/install/)

[Install Docker-Compose](https://docs.docker.com/compose/install/)

You can run the application using the development image or production/deployment image.

## Use Image

You run the docker container suing the docker-compose file in the root directory `/opentogethertube` by using the following command.

Make sure to change The `YOUTUBE_API_KEY` environment variable to your [Youtube API KEY](https://developers.google.com/youtube/v3/getting-started).

```bash
docker-compose up -d
```

Go to http://localhost:8080/ 

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

4. Go to http://localhost:8080

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

2. Open `env/production.env` and replace `API_KEY_GOES_HERE` with the api keys.

3. To build the image locally using the prod image make sure you are in the project root `/opentogethertube`
   before runing the command below.

```bash
docker-compose -f docker/prod/docker-compose.yml up -d
```

4. After Go to http://localhost:8080/

## Debug

You can open a shell inside of the container with the following command.

```bash
docker exec -it opentogethertube_<dev or prod> sh
```

You can also see the logs for the multiples containers with the following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml logs
```

You can check for the status of the application and the other container in the docker-compose file with the following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml ps
```

You also rebuild the docker image with the following command.

```bash
docker-compose -f docker/<dev or prod>/docker-compose.yml up -d --build
```

## Deploy Docker image to the Docker hub

Use the production Dockerfile that is optimized for a smaller size image for Docker Hub

To use the create the deploy image, please follow the steps below.

1. Next you need to set up your configuration. Start by copying the example
   config in the `env` folder to a new file called `example.env`

```bash
cp env/example.env env/production.env
```

2. Open `env/production.env` and make sure the file is empty to not leak any api keys.

3. To build the image, make sure you are in the project root `/opentogethertube`.

```bash
DOCKER_HUB_USERNAME=yourhubusername
PACKAGE_VERSION=$(node -p "require('./package.json').version")
docker build -f docker/prod/Dockerfile -t $DOCKER_HUB_USERNAME/opentogethertube:$PACKAGE_VERSION .
```

4. Login to Docker hub and push the docker image

```bash
docker login --username=$DOCKER_HUB_USERNAME # enter your password
docker push $DOCKER_HUB_USERNAME/opentogethertube:$PACKAGE_VERSION
```

### Setup Travis CI

1. Install travis cli tool to add secret env to the ci

```bash
sudo gem install travis
travis login
travis encrypt DOCKER_HUB_USERNAME=<email> --add
travis encrypt DOCKER_HUB_PASSWORD=<password> --add
```

2. This will add env to the `.travis.yml` section with the secret password and username for docker hub
