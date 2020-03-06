FROM node:alpine3.11

# Environnement variable redis/postgres/webport
ENV REDIS_PORT 6379
ENV REDIS_PASSWORD redis
ENV DB_PASSWORD postgres
ENV PORT 8080

# Install sqlite3
RUN apk update -q
RUN apk add sqlite -q

# Create app directory
WORKDIR /usr/app

# Install app dependencies
COPY dist .
COPY node_modules .
COPY package.json .
RUN npm install --production

# Build dist
RUN npm run build

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# Environnement variable nodejs
ENV NODE_ENV production

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 )

# Start Server
CMD [ "npm", "run", "start" ]



