FROM node:lts

# Environnement variable
ENV REDIS_PORT="6379"
ENV REDIS_HOST="127.0.0.1"
ENV REDIS_PASSWORD="redis"
ENV REDIS_DB="opentogethertubedev"
ENV DB_PASSWORD=""
ENV PORT="3000"

# Install sqlite3
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# NODE_ENV
ENV NODE_ENV=development

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:3000/ || exit 1 )

# Start Server
CMD [ "npm", "run", "dev" ]




