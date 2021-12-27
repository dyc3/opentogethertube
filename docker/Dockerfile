### Build stage ###
FROM node:14-alpine3.11 as build-stage

# Create app directory
WORKDIR /usr/app

# Copy the important file
COPY . .

# Install app dependencies
RUN apk update -q && apk --no-cache add libc6-compat python make g++ autoconf automake libtool -q

# Install app dependencies
RUN yarn

# Build the application for deployement
RUN yarn run build

RUN rm -rf node_modules && yarn install --production=true

### Deployement server nginx ###
FROM node:14-alpine3.11 as production-stage

# Create app directory
WORKDIR /usr/app/

# Environnement variable redis/postgres/webport
ENV REDIS_PORT 6379
# Environnement variable nodejs
ENV NODE_ENV production
ENV PORT 8080

# Copy from build stage
COPY --from=build-stage /usr/app/ /usr/app/
COPY --from=build-stage /usr/app/docker/scripts/wait_for_db.sh /usr/app/wait_for_db.sh

# Remove all the unnecessary files
RUN rm -rf client/public client/src client/.browserslistrc .eslintrc.js .gitignore postcss.config.js client/vue.config.js client/babel.config.js docker-compose.yml /root/.npm

RUN mkdir env && touch env/production.env

RUN apk update -q && apk --no-cache add curl -q

# Healthcheck API, WEB, REDIS
HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

# Start Server
CMD ["/bin/sh", "wait_for_db.sh", "postgres_db:5432", "--", "npm", "run", "start"]