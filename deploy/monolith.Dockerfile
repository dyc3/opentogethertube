FROM node:18-alpine3.16 as build-stage
ARG GIT_COMMIT

WORKDIR /usr/app

RUN apk update -q && apk --no-cache add libc6-compat python3 make g++ autoconf automake libtool -q
COPY . .
RUN yarn
RUN yarn run build

RUN rm -rf node_modules && yarn install --production=true

FROM node:18-alpine3.16 as production-stage
ARG DEPLOY_TARGET

WORKDIR /usr/app/

ENV NODE_ENV production
ENV FFPROBE_PATH /usr/bin/ffprobe

RUN apk update -q && apk --no-cache add curl ffmpeg -q

COPY --from=build-stage /usr/app/ /usr/app/

RUN rm -rf client/public client/src client/.browserslistrc .eslintrc.js .gitignore client/vite.config.js docker-compose.yml /root/.npm deploy crates tools

COPY deploy/base.toml /usr/app/env/
COPY deploy/$DEPLOY_TARGET.toml /usr/app/env/production.toml

# Healthcheck API, WEB, REDIS
HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

# Start Server
CMD ["yarn", "workspace", "ott-server", "run", "start-lean"]