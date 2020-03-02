FROM node:lts

# Port for web server
ENV PORT=8080
EXPOSE 8080
ENV NODE_ENV=production

# Install sqlite3 and redis
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3 redis-server postgresql

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install 

# Build dist
RUN npm run build

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# Start Server
CMD [ "nohup", "redis-server", "&", ";", "npm", "run", "start" ]

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 ) && ( redis-cli ping || exit 1 )

