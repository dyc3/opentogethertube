FROM node:lts

# Port for web server
ENV PORT=3000
ENV WEB_PORT=8080
ENV REDIS_PORT=6379
ENV NODE_ENV=development

# Expose Port
EXPOSE 8080
EXPOSE 3000
EXPOSE 6379

# Install sqlite3 and redis
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3 redis-server postgresql

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# Start Server
CMD [ "nohup", "redis-server", "&", ";", "npm", "run", "dev" ]

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 ) &&  ( curl -f http://localhost:3000/ || exit 1 ) && ( redis-cli ping || exit 1 )


