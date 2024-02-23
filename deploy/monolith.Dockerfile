# Optimized for layer cache hits to speed up builds

FROM node:18-alpine3.19 as dep-install-stage

WORKDIR /app
RUN apk update -q && apk --no-cache add libc6-compat python3 make g++ autoconf automake libtool -q
COPY package.json yarn.lock ./
COPY common/package.json common/
COPY client/package.json client/
COPY server/package.json server/
RUN yarn install --frozen-lockfile

FROM node:18-alpine3.19 as build-stage
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app
RUN apk update -q && apk --no-cache add libc6-compat python3 make g++ autoconf automake libtool -q
COPY tsconfig.json ./
COPY common common
COPY client client
COPY server server
COPY --from=dep-install-stage /app /app
RUN yarn workspace ott-common run build && yarn workspace ott-client run build && yarn workspace ott-server run build
RUN rm -rf packages/ott-vis*
RUN rm -rf node_modules && yarn install --production=true

FROM node:18-alpine3.19 as production-stage

WORKDIR /app
COPY --from=build-stage /app /app
RUN rm -rf client/public client/src client/.browserslistrc .eslintrc.js .gitignore client/vite.config.js client/babel.config.js docker-compose.yml /root/.npm tools crates

FROM node:18-alpine3.19 as docker-stage
# For use in docker-compose

WORKDIR /app
ENV NODE_ENV production
ENV FFPROBE_PATH /usr/bin/ffprobe
RUN apk update -q && apk --no-cache add curl ffmpeg -q
COPY docker/scripts/wait_for_db.sh /app/wait_for_db.sh
COPY --from=production-stage /app /app
HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

CMD ["/bin/sh", "wait_for_db.sh", "--", "yarn", "run", "start"]

FROM node:18-alpine3.19 as deploy-stage
# For deployment on Fly
ARG DEPLOY_TARGET

WORKDIR /app
ENV NODE_ENV production
ENV FFPROBE_PATH /usr/bin/ffprobe
RUN apk update -q && apk --no-cache add curl ffmpeg -q
COPY --from=production-stage /app /app
COPY deploy/base.toml /app/env/
COPY deploy/$DEPLOY_TARGET.toml /app/env/production.toml
HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

CMD ["yarn", "workspace", "ott-server", "run", "start-lean"]
