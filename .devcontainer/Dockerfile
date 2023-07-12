FROM mcr.microsoft.com/devcontainers/base:bullseye

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get -y update --no-install-recommends \
	&& apt-get -y install --no-install-recommends \
	build-essential \
	curl \
	ca-certificates \
	apt-utils \
	dialog \
	git \
	vim \
	libsqlite3-dev \
	libpq-dev \
	libnss3 \
	libnspr4 \
	libatk1.0-0 \
	libatk-bridge2.0-0 \
	libcups2 \
	libdrm2 \
	libdbus-1-3 \
	libatspi2.0-0 \
	libx11-6 \
	libxcomposite1 \
	libxdamage1 \
	libxext6 \
	libxfixes3 \
	libxrandr2 \
	libgbm1 \
	libxcb1 \
	libxkbcommon0 \
	libpango-1.0-0 \
	libcairo2 \
	libasound2 \
	libsodium-dev \
	libtool-bin \
	&& apt-get autoremove -y \
	&& apt-get clean -y

RUN curl -fsSL https://raw.githubusercontent.com/devcontainers/features/main/src/node/install.sh | VERSION=18 bash -
RUN curl -fsSL https://raw.githubusercontent.com/devcontainers/features/main/src/rust/install.sh | bash -
RUN curl -fsSL https://raw.githubusercontent.com/devcontainers/features/main/src/github-cli/install.sh | bash -

ENV DEBIAN_FRONTEND=dialog

USER $USERNAME