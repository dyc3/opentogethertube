FROM node:lts

# Environnement variable redis/postgres/webport
ENV REDIS_PORT 6379
ENV REDIS_PASSWORD redis
ENV REDIS_DB opentogethertube
ENV DB_PASSWORD postgres
ENV PORT 8080

# Install sqlite3
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install

# Build dist
RUN npm run build

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# Environnement variable nodejs
ENV NODE_ENV production
ENV NODE_OPTIONS "--max-http-header-size=16000"

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 )

# Start Server
CMD [ "npm", "run", "start" ]



