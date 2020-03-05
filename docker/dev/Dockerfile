FROM node:lts

# Environnement variable redis
ENV REDIS_PORT 6379

# Install sqlite3
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3 redis-tools

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install

# Initialize your local database.
RUN npx sequelize-cli db:migrate

#  Environnement variable nodejs
ENV NODE_ENV development
ENV NODE_OPTIONS "--max-http-header-size=16000"

# Start Server
CMD [ "npm", "run", "dev" ]




