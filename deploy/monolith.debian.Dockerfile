# Optimized for layer cache hits to speed up builds

FROM node:20-bookworm-slim AS dep-install-stage

WORKDIR /app

# Enable Corepack (Yarn)
RUN corepack enable

# Install build dependencies (Python needed for node-gyp, etc.)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ autoconf automake libtool \
    && rm -rf /var/lib/apt/lists/*

# Copy root workspace manifests
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Copy per-package manifests for selective install
COPY common/package.json common/
COPY client/package.json client/
COPY server/package.json server/

# Focus only needed workspaces for build (deps only)
RUN yarn workspaces focus ott-common ott-client ott-server

FROM node:20-bookworm-slim AS build-stage
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    python3 make g++ autoconf automake libtool \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Copy TS config and sources
COPY tsconfig.json ./
COPY common common
COPY client client
COPY server server

# Copy node_modules + yarn metadata from dep stage
COPY --from=dep-install-stage /app /app
COPY --from=dep-install-stage /root/.yarn /root/.yarn

# Build all workspaces
RUN yarn workspace ott-common run build \
    && yarn workspace ott-client run build \
    && yarn workspace ott-server run build

# Remove any visualizer / unnecessary packages (mirrors original intent)
RUN rm -rf packages/ott-vis*

# Prune to production dependencies only for ott-server
RUN rm -rf node_modules \
    && yarn workspaces focus ott-server --production

FROM node:20-bookworm-slim AS production-stage

WORKDIR /app
RUN corepack enable

# Copy built application
COPY --from=build-stage /app /app

# Remove dev/build artifacts & extraneous files similar to original
RUN rm -rf \
    client/public \
    client/src \
    client/.browserslistrc \
    .eslintrc.js \
    .gitignore \
    client/vite.config.js \
    client/babel.config.js \
    docker-compose.yml \
    /root/.npm \
    tools \
    crates

FROM node:20-bookworm-slim AS docker-stage
# For use in docker-compose

WORKDIR /app
ENV NODE_ENV=production
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Runtime dependencies: curl, ffmpeg (for probing)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY docker/scripts/wait_for_db.sh /app/wait_for_db.sh
COPY --from=production-stage /app /app

HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

CMD ["/bin/sh", "wait_for_db.sh", "--", "yarn", "run", "start"]

FROM node:20-bookworm-slim AS deploy-stage
# For deployment on Fly
ARG DEPLOY_TARGET

WORKDIR /app
ENV NODE_ENV=production
ENV FFPROBE_PATH=/usr/bin/ffprobe

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY --from=production-stage /app /app
COPY deploy/base.toml /app/env/
COPY deploy/$DEPLOY_TARGET.toml /app/env/production.toml

HEALTHCHECK --interval=30s --timeout=3s CMD ( curl -f http://localhost:8080/api/status || exit 1 )

CMD ["yarn", "workspace", "ott-server", "run", "start-lean"]
