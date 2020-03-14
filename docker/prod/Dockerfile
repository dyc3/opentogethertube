### Build stage ###
FROM node:alpine3.11 as build-stage

# Create app directory
WORKDIR /usr/app

# Copy the important file
COPY . .

# Install app dependencies
RUN npm install

# Build the application for deployement
RUN npm run build



### Deployement server nginx ###
FROM node:alpine3.11 as production-stage

# Create app directory
WORKDIR /usr/app/

# Environnement variable redis/postgres/webport
ENV REDIS_PORT 6379
# Environnement variable nodejs
ENV NODE_ENV production
ENV PORT 8080

# Install sqlite3
RUN apk update -q
RUN apk add sqlite curl -q

# Copy from build stage
COPY --from=build-stage /usr/app/ /usr/app/
COPY --from=build-stage /usr/app/docker/scripts/wait_for_db.sh /usr/app/wait_for_db.sh

# Install app dependencies
RUN npm install --production

# Remove all the unnecessary directories
RUN rm -rf docker .github .vscode db public test src

# Remove all the unnecessary files
RUN rm -rf env .browserslistrc .eslintrc.js .gitignore .travis.yml codecov.yaml
RUN rm -rf jest.config.js postcss.config.js vue.config.js babel.config.js docker-compose.yml

RUN mkdir env && touch env/production.env 

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 )

# Start Server
CMD ["/bin/sh", "wait_for_db.sh", "postgres_db:5432", "--", "npm", "run", "start"]