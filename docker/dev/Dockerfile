FROM node:lts

# Port for web server
ENV PORT=3000
ENV WEB_PORT=8080
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=redis
ENV REDIS_DB=opentogethertubedev

# Expose Port
EXPOSE 8080
EXPOSE 3000

# Install sqlite3 and redis
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




