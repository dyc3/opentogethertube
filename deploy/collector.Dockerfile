FROM rust:1-slim-buster as build-stage

WORKDIR /app/
COPY . .
RUN apt-get update && apt-get install -y build-essential pkg-config openssl libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release --bin ott-collector && mv ./target/release/ott-collector . && cargo clean

FROM debian:buster-slim as production-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y openssl dnsutils && rm -rf /var/lib/apt/lists/*
RUN ulimit -c unlimited
COPY --from=build-stage /app/ott-collector /app/

ARG DEPLOY_TARGET
# COPY deploy/$DEPLOY_TARGET.toml /app/collector.toml

ENV ROCKET_ADDRESS=0.0.0.0
CMD ["./ott-collector"]
