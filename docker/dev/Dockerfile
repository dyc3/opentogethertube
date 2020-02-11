FROM node:lts

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .
RUN npm install

# build dist
RUN npm run build

# Initialize your local database.
RUN npx sequelize-cli db:migrate

# Port for web server
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=development

# Start Server
CMD [ "npm", "run", "dev" ]
