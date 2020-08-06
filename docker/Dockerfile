### Build stage ###
FROM node:alpine3.11 as build-stage

# Create app directory
WORKDIR /usr/app

# Copy the important file
COPY . .

# Install app dependencies
RUN apk update -q && apk --no-cache add libc6-compat python make g++ autoconf automake libtool -q

# Install app dependencies
RUN npm install

# Build the application for deployement
RUN npm run build

RUN rm -rf node_modules && npm install --only=production

### Deployement server nginx ###
FROM node:alpine3.11 as production-stage

# Create app directory
WORKDIR /usr/app/

# Environnement variable redis/postgres/webport
ENV REDIS_PORT 6379
# Environnement variable nodejs
ENV NODE_ENV production
ENV PORT 8080

RUN apk update -q && apk add libc6-compat python make g++ autoconf automake libtool -q && rm -rf /var/cache/apk/*

# Copy from build stage
COPY --from=build-stage /usr/app/ /usr/app/
COPY --from=build-stage /usr/app/docker/scripts/wait_for_db.sh /usr/app/wait_for_db.sh

# Remove all the unnecessary files
RUN rm -rf public src .browserslistrc .eslintrc.js .gitignore jest.config.js postcss.config.js vue.config.js babel.config.js docker-compose.yml /root/.npm
RUN apk del python make g++ autoconf automake libtool -q

RUN mkdir env && touch env/production.env
RUN npx sequelize-cli db:migrate

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 )

# Start Server
CMD ["/bin/sh", "wait_for_db.sh", "postgres_db:5432", "--", "npm", "run", "start"]