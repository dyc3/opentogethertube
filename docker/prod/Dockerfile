FROM node:lts

# Port for web server
ENV PORT=8080
EXPOSE 8080

# Install sqlite3 and redis
RUN apt-get update -qq
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sqlite3 git

# Create app directory
WORKDIR /usr/src/

# Install app dependencies
RUN git clone https://github.com/dyc3/opentogethertube app 
WORKDIR /usr/src/app
RUN npm install 

# Build dist
RUN npm run build

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# NODE_ENV
ENV NODE_ENV=production

# Healthcheck API, WEB, REDIS
HEALTHCHECK CMD ( curl -f http://localhost:8080/ || exit 1 )

# Start Server
CMD [ "npm", "run", "start" ]



